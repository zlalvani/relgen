import type { AnthropicMessagesModelId } from '@ai-sdk/anthropic/internal';
import type { OpenAIChatModelId } from '@ai-sdk/openai/internal';
import { LinearClient } from '@linear/sdk';
import dedent from 'dedent';
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
  template?: string;
};

const relgen = ({
  args,
  deps,
}: {
  args: {
    template?: string;
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
      describe: async () => {
        throw new Error('Not implemented');
      },
    },
    pr: {
      describe: async ({
        owner,
        repo,
        num,
      }: {
        owner: string;
        repo: string;
        num: number;
      }) => {
        const [pr, diff] = await Promise.all([
          github.rest.pulls.get({
            owner,
            repo,
            pull_number: num,
          }),
          github.custom.pulls.diff({
            owner,
            repo,
            num,
          }),
        ]);

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

        const diffContext = makeContext({
          source: 'github',
          type: 'diff',
          data: diff,
          prompt: dedent`
          <diff>
            <raw>${diff.data.$raw}</raw>
          </diff>,
          `,
        });

        const result = await llm.pr.describe({
          change: {
            pr: prContext,
            diff: diffContext,
          },
        });

        console.log(result.object);

        // if (args.write.pr) {
        //   await github.rest.pulls.update({
        //     owner,
        //     repo,
        //     pull_number: num,
        //     title: result.object.title,
        //     body: result.object.description,
        //   });
        // }
      },
      label: async (pullRequestUrl: string) => {
        throw new Error('Not implemented');
      },
    },
    issue: {
      label: async () => {
        throw new Error('Not implemented');
      },
    },
  };
};

export const createRelgen = (options: RelgenOptions) => {
  const { model, template, integrations } = options;

  return relgen({
    args: {
      template,
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
