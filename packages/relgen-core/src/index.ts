import type { AnthropicMessagesModelId } from '@ai-sdk/anthropic/internal';
import type { OpenAIChatModelId } from '@ai-sdk/openai/internal';
import { LinearClient } from '@linear/sdk';
import pino from 'pino';
import { dedent, group, parallel } from 'radashi';
import type { MergeExclusive } from 'type-fest';
import { type GithubClient, createGithubClient } from './clients/github';
import { makeContext } from './services/context';
import {
  type LanguageModelService,
  type PullRequestDescribe,
  PullRequestDescribeSchema,
  createLanguageModelService,
} from './services/llm';
import { type RemoteService, createRemoteService } from './services/remote';

export type RelgenOptions = {
  llm:
    | {
        apiKey: string;
        provider: 'openai';
        model: OpenAIChatModelId;
      }
    | {
        apiKey: string;
        provider: 'anthropic';
        model: AnthropicMessagesModelId;
      };
  write?: {
    release?: boolean;
    pr?: boolean;
    issue?: boolean;
  };
  logger?: pino.Logger;
  integrations: {
    github: {
      token: string;
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

const excludedFiles = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
]);

const RELGEN_TAG = '<!-- Generated by Relgen -->';

function serializePullRequestRelgenMetadata(metadata: PullRequestDescribe) {
  return dedent`
  <!-- METADATA
  ${JSON.stringify(metadata)}
  -->
  `;
}

function getPullRequestRelgenMetadata(body?: string) {
  if (!body) {
    return null;
  }

  const parsed = PullRequestDescribeSchema.safeParse(
    JSON.parse(
      body.match(/<!-- METADATA\n(.*?)\n-->/s)?.[1]?.replaceAll('\n', '\\n') ??
        '{}'
    )
  );

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

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
    remote: RemoteService;
    github: GithubClient;
    logger: pino.Logger;
    linear?: LinearClient;
  };
}) => {
  const { llm, github, remote } = deps;

  const getUnreleasedPrs = async ({
    owner,
    repo,
  }: {
    owner: string;
    repo: string;
  }) => {
    const githubRepo = await github.$rest.repos.get({
      owner,
      repo,
    });

    const defaultBranch = githubRepo.data.default_branch;

    const latest = await github.rest.repos.getLatestRelease({
      owner,
      repo,
    });

    return (
      await github.rest.search.issuesAndPullRequests({
        repo: {
          owner,
          repo,
        },
        type: 'pr',
        base: defaultBranch,
        status: 'merged',
        mergedAfter: latest?.data.published_at
          ? new Date(latest.data.published_at)
          : undefined,
      })
    ).data.items;
  };

  const getPrsBetweenTags = async ({
    owner,
    repo,
    fromTag,
    toTag,
  }: {
    owner: string;
    repo: string;
    fromTag?: string;
    toTag?: string;
  }) => {
    const githubRepo = await github.$rest.repos.get({
      owner,
      repo,
    });

    const defaultBranch = githubRepo.data.default_branch;

    const from = fromTag
      ? await github.$rest.repos.getReleaseByTag({
          owner,
          repo,
          tag: fromTag,
        })
      : undefined;

    const to = toTag
      ? await github.$rest.repos.getReleaseByTag({
          owner,
          repo,
          tag: toTag,
        })
      : undefined;

    return (
      await github.rest.search.issuesAndPullRequests({
        repo: {
          owner,
          repo,
        },
        type: 'pr',
        base: defaultBranch,
        status: 'merged',
        mergedAfter: from?.data.published_at
          ? new Date(from.data.published_at)
          : undefined,
        mergedBefore: to?.data.published_at
          ? new Date(to.data.published_at)
          : undefined,
      })
    ).data.items;
  };

  const getTimerangePrs = async ({
    owner,
    repo,
    from,
    to,
  }: {
    owner: string;
    repo: string;
    from?: Date;
    to?: Date;
  }) => {
    const githubRepo = await github.$rest.repos.get({
      owner,
      repo,
    });

    const defaultBranch = githubRepo.data.default_branch;

    return (
      await github.rest.search.issuesAndPullRequests({
        repo: {
          owner,
          repo,
        },
        type: 'pr',
        base: defaultBranch,
        status: 'merged',
        mergedAfter: from,
        mergedBefore: to,
      })
    ).data.items;
  };

  const ascribePrs = async ({
    owner,
    repo,
    prs,
    includeFileContent,
  }: {
    owner: string;
    repo: string;
    prs: Awaited<
      ReturnType<
        | typeof getUnreleasedPrs
        | typeof getPrsBetweenTags
        | typeof getTimerangePrs
      >
    >;
    includeFileContent?: boolean;
  }) => {
    const comments = await github.graphql.repo.pull.batchPullRequestComments({
      owner,
      repo,
      nums: prs.map((pr) => pr.number),
    });

    const commentsLookup = comments.reduce((acc, curr) => {
      acc.set(curr.num, curr.comments);
      return acc;
    }, new Map<number, (typeof comments)[number]['comments']>());

    const metadata = await parallel(
      3,
      prs.filter((pr) => commentsLookup.has(pr.number)),
      async (pr) => {
        // biome-ignore lint/style/noNonNullAssertion: <already filtered>
        const prComments = commentsLookup.get(pr.number)!;

        // TODO: also filter for author
        const relgenComment = pr.body?.includes(RELGEN_TAG)
          ? pr.body
          : prComments.find((comment) => comment.body?.includes(RELGEN_TAG))
              ?.body;

        return {
          pr,
          metadata:
            getPullRequestRelgenMetadata(relgenComment) ??
            (await (async () => {
              const result = await llm.pr.describe({
                change: {
                  pr: makeContext({
                    type: 'pr',
                    data: pr,
                    prompt: dedent`
                      <pr>
                        <title>${pr.title}</title>
                        <body>${pr.body}</body>
                      </pr>
                      `,
                  }),
                  files: await parallel(
                    3,
                    (
                      await github.$rest.pulls.listFiles({
                        owner,
                        repo,
                        pull_number: pr.number,
                      })
                    ).data,
                    async (file) => {
                      return makeContext({
                        type: 'pr-file',
                        data: {
                          fileData: file,
                          patch: file.patch ?? null,
                          path: file.filename,
                          content: null,
                        },
                        prompt: dedent`
                        <file name="${file.filename}" status="${file.status}" additions="${file.additions}" deletions="${file.deletions}">
                          ${includeFileContent ? `<content>\n${await github.http.getRawContent(file.raw_url)}\n</content>` : ''}
                          <patch>
                          ${file.patch}
                          </patch>
                        </file>
                        `,
                      });
                    }
                  ),
                },
              });

              return result.object;
            })()),
        };
      }
    );

    return Object.entries(
      group(metadata, (item) => item.pr.user?.login ?? 'unknown')
    )
      .filter(<K, V>(entry: [K, V | undefined]): entry is [K, V] => !!entry[1])
      .map(([author, items]) => {
        return {
          author,
          items: items.map((item) => {
            return {
              pr: {
                title: item.pr.title,
                url: item.pr.html_url,
              },
              relgen: item.metadata,
            };
          }),
        };
      });
  };

  return {
    remote: {
      ascribe: async (
        args: {
          owner: string;
          repo: string;
          from?: Date;
          to?: Date;
        },
        options?: {
          excludedPattern?: RegExp;
          excludedContexts?: 'file-content'[];
        }
      ) => {
        const { owner, repo, from, to } = args;
        const prs = (await getTimerangePrs({ owner, repo, from, to })).filter(
          (pr) =>
            !options?.excludedPattern ||
            !options?.excludedPattern.test(pr.title)
        );

        return ascribePrs({
          owner,
          repo,
          prs,
          includeFileContent:
            !options?.excludedContexts?.includes('file-content'),
        });
      },
      release: {
        ascribe: async (
          args: {
            owner: string;
            repo: string;
          } & MergeExclusive<
            {
              toTag?: string;
              fromTag?: string;
            },
            {
              unreleased?: true;
            }
          >,
          options?: {
            excludedPattern?: RegExp;
            excludedContexts?: 'file-content'[];
          }
        ) => {
          const { owner, repo, toTag, fromTag, unreleased } = args;

          const selectedPrs = (
            unreleased
              ? await getUnreleasedPrs({ owner, repo })
              : await getPrsBetweenTags({
                  owner,
                  repo,
                  fromTag,
                  toTag,
                })
          ).filter(
            (pr) =>
              !options?.excludedPattern ||
              !options?.excludedPattern.test(pr.title)
          );

          if (!selectedPrs.length) {
            return null;
          }

          return ascribePrs({
            owner,
            repo,
            prs: selectedPrs,
            includeFileContent:
              !options?.excludedContexts?.includes('file-content'),
          });
        },
        describe: async (
          args: {
            owner: string;
            repo: string;
          } & MergeExclusive<
            {
              toTag?: string;
              fromTag?: string;
            },
            {
              unreleased?: true;
            }
          >,
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
          const { owner, repo, toTag, fromTag, unreleased } = args;

          const contexts = unreleased
            ? await remote.context.pr.unreleased({
                owner,
                repo,
                include: {
                  issues:
                    (options?.include === 'all' || options?.include?.issues) ??
                    false,
                },
              })
            : await remote.context.pr.betweenTags({
                owner,
                repo,
                fromTag,
                toTag,
                include: {
                  issues:
                    (options?.include === 'all' || options?.include?.issues) ??
                    false,
                },
              });

          if (!contexts.length) {
            return null;
          }

          const result = await llm.release.describe(
            {
              changes: contexts,
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
        review: async (
          args: {
            owner: string;
            repo: string;
            num: number;
            rules: string[];
          },
          options?: {
            extraInstructions?: string;
            write?: boolean;
          }
        ) => {
          const { owner, repo, num, rules } = args;

          const [pr, files] = await Promise.all([
            remote.context.pr.get({
              owner,
              repo,
              num,
            }),
            remote.context.pr.files({
              owner,
              repo,
              num,
              excludedContexts: {
                fileContent: true,
              },
            }),
          ]);

          const result = await llm.pr.review(
            {
              pr: pr.pr,
              files,
              rules,
            },
            {
              extraInstructions: options?.extraInstructions,
            }
          );

          if (options?.write) {
            await remote.write.pr.review({
              context: {
                pr: pr.pr,
                files,
              },
              generated: result,
            });
          }

          return result.object;
        },
        describe: async (
          args: {
            owner: string;
            repo: string;
            num: number;
          },
          options?: {
            write?: ('title' | 'comment' | 'description')[] | false;
            template?: string;
            prompt?: string;
            footer?: string;
            excludedContexts?: ('ticket' | 'file-content')[];
          }
        ) => {
          const { owner, repo, num } = args;

          const { footer, prompt, template } = options ?? {};

          const selectedWrites = Array.isArray(options?.write)
            ? new Set(options.write)
            : undefined;

          const excludedContexts = new Set(options?.excludedContexts ?? []);

          const [pr, files] = await Promise.all([
            remote.context.pr.get({
              owner,
              repo,
              num,
            }),
            remote.context.pr.files({
              owner,
              repo,
              num,
              excludedContexts: {
                fileContent: excludedContexts.has('file-content'),
              },
              excludedFiles,
            }),
          ]);

          const result = await llm.pr.describe(
            {
              change: {
                pr: pr.pr,
                files,
              },
            },
            {
              template,
              prompt,
            }
          );

          const metadata = serializePullRequestRelgenMetadata(result.object);

          const additionalContent = [footer, metadata, RELGEN_TAG]
            .filter((content) => content)
            .join('\n\n');

          const body = result.object.description
            ? `${result.object.description}\n\n${additionalContent}`
            : undefined;

          if (
            selectedWrites?.has('description') ||
            selectedWrites?.has('title')
          ) {
            await remote.write.pr.update({
              context: pr.pr,
              title: selectedWrites?.has('title')
                ? result.object.title
                : undefined,
              taggedBody: selectedWrites?.has('description') ? body : undefined,
            });
          }

          if (selectedWrites?.has('comment') && body) {
            await remote.write.pr.comment({
              context: pr.pr,
              taggedBody: body,
              tag: RELGEN_TAG,
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
            write?: 'add' | 'set' | false;
            exclude?: 'existing' | string[];
            prompt?: string;
          }
        ) => {
          const { owner, repo, num } = args;

          const [labels, pr, diff] = await Promise.all([
            remote.context.labels.get({
              owner,
              repo,
              exclude: new Set(
                Array.isArray(options?.exclude) ? options.exclude : []
              ),
            }),
            remote.context.pr.get({
              owner,
              repo,
              num,
            }),
            remote.context.pr.diff({
              owner,
              repo,
              num,
            }),
          ]);

          const result = await llm.pr.label(
            {
              change: {
                pr: pr.pr,
                diff,
              },
              labels,
              existing: options?.exclude === 'existing' ? undefined : pr.labels,
            },
            {
              prompt: options?.prompt,
            }
          );

          if (options?.write) {
            await remote.write.pr.label({
              context: pr.pr,
              generated: result,
              mode: options.write,
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
            write?: 'add' | 'set' | false;
            exclude?: 'existing' | string[];
            prompt?: string;
          }
        ) => {
          const { owner, repo, num } = args;

          const [labels, issue] = await Promise.all([
            remote.context.labels.get({
              owner,
              repo,
              exclude: new Set(
                Array.isArray(options?.exclude) ? options.exclude : []
              ),
            }),
            remote.context.issue.get({
              owner,
              repo,
              num,
            }),
          ]);

          const result = await llm.issue.label(
            {
              issue: issue.issue,
              labels,
              existing:
                options?.exclude === 'existing' ? undefined : issue.labels,
            },
            {
              prompt: options?.prompt,
            }
          );

          if (options?.write) {
            await remote.write.issue.label({
              context: issue.issue,
              generated: result,
              mode: options.write,
            });
          }

          return result.object;
        },
        duplicates: async () => {
          throw new Error('Not implemented');
        },
      },
    },
    commit: {
      describe: async () => {
        throw new Error('Not implemented');
      },
    },
  };
};

export const createRelgen = (options: RelgenOptions) => {
  const { llm, integrations } = options;

  let logger = options.logger;

  logger = logger ?? pino();

  const github = createGithubClient({ token: integrations.github.token });

  return relgen({
    args: {
      write: {
        release: options.write?.release ?? false,
        pr: options.write?.pr ?? false,
        issue: options.write?.issue ?? false,
      },
    },
    deps: {
      logger: logger,
      github,
      remote: createRemoteService(
        {
          github,
        },
        logger
      ),
      llm: createLanguageModelService(llm, logger),
      linear:
        integrations.linear &&
        new LinearClient({ apiKey: integrations.linear.token }),
    },
  });
};

export type Relgen = ReturnType<typeof createRelgen>;
