import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { type LanguageModel, generateObject } from 'ai';
import dedent from 'dedent';
import { z } from 'zod';
import type { RelgenOptions } from '..';
import type {
  DiffContext,
  PullRequestContext,
  TicketContext,
} from '../contexts';

export const languageModelService = (model: LanguageModel) => {
  return {
    release: {
      describe: async (context: {
        changes: {
          pr: PullRequestContext;
          diff: DiffContext;
        }[];
        tickets?: TicketContext[];
      }) => {
        if (!context.changes[0]) {
          throw new Error('No pull requests found');
        }

        return await Promise.resolve({});
      },
    },
    pr: {
      describe: async (
        context: {
          change: {
            pr: PullRequestContext;
            diff: DiffContext;
          };
          ticket?: TicketContext;
        },
        options?: {
          template?: string;
        }
      ) => {
        const prompt = dedent`
          Here's the relevant context:
          ${context.change.pr.prompt}
          ${context.change.diff.prompt}

          ${
            options?.template
              ? dedent`
              Here's a template to use for your response:
              <template>
              ${options.template}
              </template>`
              : ''
          }
          `;

        return await generateObject({
          model,
          schema: z.object({
            description: z.string().optional(),
          }),
          system: dedent`
          You are an expert software engineer tasked with summarizing a pull request.
          Use the given context to generate a summary that will be added as a comment.
          Keep your output concise and relevant.
          If provided, follow the template as closely as possible.
          DO NOT RETURN A DESCRIPTION if you lack enough context.
          DO NOT RETURN A DESCRIPTION if the description is already good.
          `,
          prompt,
        });
      },
      label: async () => {},
    },
    issue: {
      label: async () => {},
    },
  };
};

export const createLanguageModelService = (options: RelgenOptions['model']) => {
  const { apiKey } = options;

  switch (options.provider) {
    case 'openai': {
      return languageModelService(
        createOpenAI({ apiKey }).chat(options.modelId)
      );
    }
    case 'anthropic': {
      return languageModelService(
        createAnthropic({ apiKey }).languageModel(options.modelId)
      );
    }
    default: {
      throw new Error('Invalid model provider');
    }
  }
};

export type LanguageModelService = ReturnType<typeof languageModelService>;
