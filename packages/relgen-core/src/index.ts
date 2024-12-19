import type { AnthropicMessagesModelId } from '@ai-sdk/anthropic/internal';
import type { OpenAIChatModelId } from '@ai-sdk/openai/internal';
import { LinearClient } from '@linear/sdk';
import dedent from 'dedent';
import { unique } from 'radashi';
import type { MergeExclusive } from 'type-fest';
import { type GithubClient, createGithubClient } from './clients/github';
import { makeContext } from './contexts';
import {
  type LanguageModelService,
  createLanguageModelService,
} from './services/llm';

export type RelgenOptions = {
  model:
    | {
        apiKey: string;
        provider: 'openai';
        modelId: OpenAIChatModelId;
      }
    | {
        apiKey: string;
        provider: 'anthropic';
        modelId: AnthropicMessagesModelId;
      };
  write?: {
    release?: boolean;
    pr?: boolean;
    issue?: boolean;
  };
  integrations: {
    github: {
      token: string;
      repoUrl?: string;
    };
  } & MergeExclusive<
    {
      linear?: {
        token: string;
      };
    },
    {
      jira?: {
        token: string;
      };
    }
  >;
};

const relgen = ({
  args,
  deps,
}: {
  args: {
    write: {
      release: boolean;
      pr: boolean;
      issue: boolean;
    };
  };
  deps: {
    llm: LanguageModelService;
    github: GithubClient;
    linear?: LinearClient;
  };
}) => {
  const { llm, github } = deps;

  return {
    release: {
      describe: async (
        args: {
          owner: string;
          repo: string;
        },
        options?: {
          persona?: 'marketing' | 'engineering' | 'product' | 'leadership';
          write?:
            | {
                name: string;
                tag: string;
              }
            | false;
          template?: string;
          prompt?: string;
          include?:
            | 'all'
            | {
                issues?: boolean;
                tickets?: boolean;
              };
        }
      ) => {
        const { owner, repo } = args;

        const release = await github.rest.repos.getLatestRelease({
          owner,
          repo,
        });

        const newPrs = await github.rest.search.issuesAndPullRequests({
          repo: {
            owner,
            repo,
          },
          type: 'pr',
          status: 'merged',
          mergedAfter: release?.data.published_at
            ? new Date(release.data.published_at)
            : undefined,
        });

        if (!newPrs.data.items.length) {
          return null;
        }

        const issues =
          options?.include === 'all' || options?.include?.issues
            ? await github.graphql.repo.pull.batchClosingIssuesReferences({
                owner,
                repo,
                nums: newPrs.data.items.map((pr) => pr.number),
              })
            : [];

        const issueMap = issues.reduce((acc, curr) => {
          acc.set(curr.num, curr.issues);
          return acc;
        }, new Map<number, (typeof issues)[number]['issues']>());

        const changeContexts = newPrs.data.items.map((pr) => {
          // Only take the first linked issue for now
          const issue = issueMap.get(pr.number)?.[0];

          return {
            pr: makeContext({
              source: 'github',
              type: 'pr',
              data: pr,
              prompt: dedent`
              <pr>
                <title>${pr.title}</title>
                <body>${pr.body}</body>
              </pr>
              `,
            }),
            issue: issue
              ? makeContext({
                  source: 'github',
                  type: 'issue',
                  data: issue,
                  prompt: dedent`
                  <issue>
                    <title>${issue.title}</title>
                    <body>${issue.body}</body>
                  </issue>
                  `,
                })
              : undefined,
          };
        });

        const result = await llm.release.describe(
          {
            changes: changeContexts,
          },
          {
            persona: options?.persona,
            template: options?.template,
            prompt: options?.prompt,
          }
        );

        return result.object;
      },
    },
    pr: {
      describe: async (
        args: {
          owner: string;
          repo: string;
          num: number;
        },
        options?: {
          write?: 'pr' | 'comment' | false;
          template?: string;
          prompt?: string;
        }
      ) => {
        const { owner, repo, num } = args;

        const [pr, diff] = await Promise.all([
          github.$rest.pulls.get({
            owner,
            repo,
            pull_number: num,
          }),
          github.rest.pulls.diff({
            owner,
            repo,
            num,
          }),
        ]);

        if (!diff) {
          throw new Error('No diff found');
        }

        const prContext = makeContext({
          source: 'github',
          type: 'pr',
          data: pr,
          prompt: dedent`
          <pr>
            <title>${pr.data.title}</title>
            <body>${pr.data.body}</body>  
          </pr>`,
        });

        // TODO: filter lockfiles from the diff
        const diffContext = makeContext({
          source: 'github',
          type: 'diff',
          data: diff,
          prompt: dedent`
          <diff>
            <raw>
            ${diff.data.$raw}
            </raw>
          </diff>,
          `,
        });

        const result = await llm.pr.describe(
          {
            change: {
              pr: prContext,
              diff: diffContext,
            },
          },
          {
            template: options?.template,
            prompt: options?.prompt,
          }
        );

        if (options?.write === 'pr') {
          await github.$rest.pulls.update({
            owner,
            repo,
            pull_number: num,
            body: result.object.description,
          });
        }

        return result.object;
      },
      label: async (
        args: {
          owner: string;
          repo: string;
          num: number;
        },
        options?: {
          write?: 'additive' | 'replacing' | false;
          exclude?: 'existing' | string[];
          prompt?: string;
        }
      ) => {
        const { owner, repo, num } = args;

        const [labels, pr, diff] = await Promise.all([
          github.$rest.issues.listLabelsForRepo({
            owner,
            repo,
          }),
          github.$rest.pulls.get({
            owner,
            repo,
            pull_number: num,
          }),
          github.rest.pulls.diff({
            owner,
            repo,
            num,
          }),
        ]);

        if (!diff) {
          throw new Error('No diff found');
        }

        const prContext = makeContext({
          source: 'github',
          type: 'pr',
          data: pr,
          prompt: dedent`
          <pr>
            <title>${pr.data.title}</title>
            <body>${pr.data.body}</body>
          </pr>
          `,
        });

        const exclude = new Set(
          Array.isArray(options?.exclude) ? options.exclude : []
        );

        const labelContexts = labels.data
          .filter((label) => !exclude.has(label.name))
          .map((label) => {
            return makeContext({
              source: 'github',
              type: 'label',
              data: label,
              prompt: dedent`
              <label>
                <name>${label.name}</name>
                <description>${label.description}</description>
              </label>
            `,
            });
          });

        const existingLabels = pr.data.labels.map((label) => {
          return makeContext({
            source: 'github',
            type: 'label',
            data: label,
            prompt: dedent`
            <label>
            ${
              typeof label === 'string'
                ? `<name>${label}</name>`
                : dedent`
              <name>${label.name}</name>`
            }
            </label>
          `,
          });
        });

        const diffContext = makeContext({
          source: 'github',
          type: 'diff',
          data: diff,
          prompt: dedent`
          <diff>
            <raw>
            ${diff.data.$raw}
            </raw>
          </diff>
          `,
        });

        const result = await llm.pr.label(
          {
            change: {
              pr: prContext,
              diff: diffContext,
            },
            labels: labelContexts,
            existing:
              options?.exclude === 'existing' ? undefined : existingLabels,
          },
          {
            prompt: options?.prompt,
          }
        );

        if (options?.write) {
          await github.$rest.issues.update({
            owner,
            repo,
            issue_number: num,
            labels:
              options.write === 'replacing'
                ? result.object.labels
                : unique([...pr.data.labels, ...result.object.labels]),
          });
        }

        return result.object;
      },
    },
    issue: {
      label: async (
        args: {
          owner: string;
          repo: string;
          num: number;
        },
        options?: {
          write?: 'additive' | 'replacing' | false;
          exclude?: 'existing' | string[];
          prompt?: string;
        }
      ) => {
        const { owner, repo, num } = args;

        const [labels, issue] = await Promise.all([
          github.$rest.issues.listLabelsForRepo({
            owner,
            repo,
          }),
          github.$rest.issues.get({
            owner,
            repo,
            issue_number: num,
          }),
        ]);

        const issueContext = makeContext({
          source: 'github',
          type: 'issue',
          data: issue,
          prompt: dedent`
          <issue>
            <title>${issue.data.title}</title>
            <body>${issue.data.body}</body>
          </issue>
          `,
        });

        const exclude = new Set(
          Array.isArray(options?.exclude) ? options.exclude : []
        );

        const labelContexts = labels.data
          .filter((label) => !exclude.has(label.name))
          .map((label) => {
            return makeContext({
              source: 'github',
              type: 'label',
              data: label,
              prompt: dedent`
              <label>
                <name>${label.name}</name>
                <description>${label.description}</description>
              </label>
            `,
            });
          });

        const existingLabels = issue.data.labels.map((label) => {
          return makeContext({
            source: 'github',
            type: 'label',
            data: label,
            prompt: dedent`
            <label>
            ${
              typeof label === 'string'
                ? `<name>${label}</name>`
                : dedent`
              <name>${label.name}</name>`
            }
            </label>
          `,
          });
        });

        const result = await llm.issue.label(
          {
            issue: issueContext,
            labels: labelContexts,
            existing:
              options?.exclude === 'existing' ? undefined : existingLabels,
          },
          {
            prompt: options?.prompt,
          }
        );

        if (options?.write) {
          await github.$rest.issues.update({
            owner,
            repo,
            issue_number: num,
            labels:
              options.write === 'replacing'
                ? result.object.labels
                : unique([...issue.data.labels, ...result.object.labels]),
          });
        }

        return result.object;
      },
      duplicates: async () => {
        throw new Error('Not implemented');
      },
    },
  };
};

export const createRelgen = (options: RelgenOptions) => {
  const { model, integrations } = options;

  return relgen({
    args: {
      write: {
        release: options.write?.release ?? false,
        pr: options.write?.pr ?? false,
        issue: options.write?.issue ?? false,
      },
    },
    deps: {
      github: createGithubClient({ token: integrations.github.token }),
      llm: createLanguageModelService(model),
      linear:
        integrations.linear &&
        new LinearClient({ apiKey: integrations.linear.token }),
    },
  });
};

export type Relgen = ReturnType<typeof createRelgen>;
