import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { type LanguageModel, generateObject } from 'ai';
import dedent from 'dedent';
import type pino from 'pino';
import { z } from 'zod';
import type { RelgenOptions } from '..';
import type {
  DiffContext,
  IssueContext,
  LabelContext,
  PullRequestContext,
  TicketContext,
} from '../contexts';

export const languageModelService = (
  model: LanguageModel,
  logger: pino.Logger
) => {
  return {
    release: {
      describe: async (
        context: {
          changes: {
            pr: PullRequestContext;
            issue?: IssueContext;
            ticket?: TicketContext;
          }[];
          tickets?: TicketContext[];
        },
        options?: {
          persona?: 'marketing' | 'engineering' | 'product' | 'leadership';
          template?: string;
          prompt?: string;
        }
      ) => {
        if (!context.changes[0]) {
          throw new Error('No pull requests found');
        }

        let system: string;

        switch (options?.persona) {
          case 'marketing': {
            system = dedent`
            You are a highly experienced product manager tasked with summarizing the latest release for use in marketing materials.
            Use the given context to generate a summary that will be used in marketing materials.
            Keep your output concise and relevant.
            `;
            break;
          }
          case 'product': {
            system = dedent`
            You are a highly experienced product manager tasked with summarizing the latest release for .
            Use the given context to generate a summary that will be used in a product update.
            Keep your output concise and relevant.
            `;
            break;
          }
          case 'leadership': {
            system = dedent`
            You are a highly product manager tasked with summarizing the latest release for leadership.
            Use the given context to generate a summary that will be shown to company leadership.
            Keep your output concise and relevant.
            `;
            break;
          }
          default: {
            system = dedent`
            You are an expert software engineer tasked with summarizing the latest release for other engineers.
            Use the given context to generate a summary that will be shown on the repository releases page.
            Keep your output concise and relevant.
            `;
            break;
          }
        }

        const prompt = dedent`
        Here's the relevant context:
        ${context.changes
          .map(
            (change) => dedent`
            <change>
            ${change.pr.prompt}
            ${change.ticket?.prompt || ''}
            ${change.issue?.prompt || ''}
            </change>
            `
          )
          .join('\n')}

        ${
          options?.template
            ? dedent`
              Here's a template to use for your response:
              <template>
              ${options.template}
              </template>`
            : ''
        }

        ${
          options?.prompt
            ? dedent`
            Extra instructions:
            ${options.prompt}
            `
            : ''
        }
        `;

        logger.debug({ system, prompt });

        return await generateObject({
          model,
          schema: z.object({
            description: z.string(),
          }),
          system,
          prompt,
        });
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
          prompt?: string;
        }
      ) => {
        const system = dedent`
        You are an expert software engineer tasked with summarizing a pull request.
        Use the given context to generate a summary that will be added as a comment.
        Keep your output concise and relevant.
        If provided, follow the template as closely as possible.
        DO NOT RETURN A DESCRIPTION if you lack enough context.
        DO NOT RETURN A DESCRIPTION if the description is already good.
        `;

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

          ${
            options?.prompt
              ? dedent`
            Extra instructions:
            ${options.prompt}
            `
              : ''
          }
          `;

        logger.debug({ system, prompt });

        return await generateObject({
          model,
          schema: z.object({
            description: z.string().optional(),
          }),
          system,
          prompt,
        });
      },
      label: async (
        context: {
          change: {
            pr: PullRequestContext;
            diff: DiffContext;
          };
          labels: LabelContext[];
          existing?: LabelContext[];
        },
        options?: {
          prompt?: string;
        }
      ) => {
        const system = dedent`
        You are an expert software engineer tasked with labeling a pull request.
        Use the given context to generate a list of labels that will be added to the PR.
        If no labels are relevant, return an empty list.
        DO NOT INCLUDE A LABEL if it is not relevant.
        RARELY USE MORE THAN ONE LABEL except when it is necessary (the PR fits multiple labels very well).
        PRESERVE EXISTING LABELS if they are still relevant, even if it means using multiple labels.
        `;

        const prompt = dedent`
          Here's the PR context:
          ${context.change.pr.prompt}
          ${context.change.diff.prompt}

          Here are the available labels:
          <labels>
          ${context.labels.map((label) => label.prompt).join('\n')}
          </labels>

          ${
            context.existing
              ? dedent`
            Here are the labels already applied to the PR:
            <labels>
            ${context.existing.map((label) => label.prompt).join('\n')}
            </labels>
            `
              : ''
          }
          
          ${
            options?.prompt
              ? dedent`
            Extra instructions:
            ${options.prompt}
            `
              : ''
          }
          `;

        logger.debug({ system, prompt });

        return await generateObject({
          model,
          schema: z.object({
            labels: z.array(z.string()),
          }),
          system,
          prompt,
        });
      },
    },
    issue: {
      label: async (
        context: {
          issue: IssueContext;
          labels: LabelContext[];
          existing?: LabelContext[];
        },
        options?: {
          prompt?: string;
        }
      ) => {
        const system = dedent`
        You are an expert software engineer tasked with labeling an issue.
        Use the given context to generate a list of labels that will be added to the issue.
        If no labels are relevant, return an empty list.
        DO NOT INCLUDE A LABEL if it is not relevant.
        RARELY USE MORE THAN ONE LABEL except when it is necessary (the issue fits multiple labels very well).
        PRESERVE EXISTING LABELS if they are still relevant, even if it means using multiple labels.
        `;

        const prompt = dedent`
          Here's the issue context:
          ${context.issue.prompt}

          Here are the available labels:
          <labels>
          ${context.labels.map((label) => label.prompt).join('\n')}
          </labels>
          
          ${
            context.existing
              ? dedent`
            Here are the labels already applied to the issue:
            <labels>
            ${context.existing.map((label) => label.prompt).join('\n')}
            </labels>
            `
              : ''
          }
          
          ${
            options?.prompt
              ? dedent`
            Extra instructions:
            ${options.prompt}
            `
              : ''
          }
          `;

        logger.debug({ system, prompt });

        return await generateObject({
          model,
          schema: z.object({
            labels: z.array(z.string()),
          }),
          system,
          prompt,
        });
      },
    },
  };
};

export const createLanguageModelService = (
  options: RelgenOptions['llm'],
  logger: pino.Logger
) => {
  const { apiKey } = options;

  switch (options.provider) {
    case 'openai': {
      return languageModelService(
        createOpenAI({ apiKey }).chat(options.model),
        logger
      );
    }
    case 'anthropic': {
      return languageModelService(
        createAnthropic({ apiKey }).languageModel(options.model),
        logger
      );
    }
    default: {
      throw new Error('Invalid model provider');
    }
  }
};

export type LanguageModelService = ReturnType<typeof languageModelService>;
