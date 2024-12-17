import type { AnthropicMessagesModelId } from '@ai-sdk/anthropic/internal';
import type { OpenAIChatModelId } from '@ai-sdk/openai/internal';
import { type GithubClient, injectGithubClient } from './lib/clients/github';
import {
  type LanguageModelService,
  injectLanguageModelService,
} from './lib/llm';

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
  integrations?: {
    github?: {
      token: string;
      write: boolean;
      repoUrl?: string;
    };
    linear?: {
      token: string;
    };
    jira?: {
      token: string;
    };
    slack?: {
      token: string;
    };
  };
  template?: string;
};

const relgen = ({
  llm,
  template,
  github,
}: {
  llm: LanguageModelService;
  template?: string;
  github?: {
    client: GithubClient;
    write: boolean;
    repoUrl?: string;
  };
}) => {
  return {
    releaseNotes: {
      generate: async () => {},
    },
    pr: {
      describe: async () => {},
      label: async () => {},
    },
    issue: {
      label: async () => {},
    },
  };
};

export const createRelgen = (options: RelgenOptions) => {
  const { model, template, integrations } = options;

  return relgen({
    llm: injectLanguageModelService(model),
    template,
    github: integrations?.github && {
      client: injectGithubClient({ token: integrations.github.token }),
      write: integrations.github.write ?? false,
      repoUrl: integrations.github.repoUrl,
    },
  });
};

export type Relgen = ReturnType<typeof createRelgen>;
