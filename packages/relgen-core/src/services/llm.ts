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
  PullRequestFileContext,
  TicketContext,
} from '../contexts';

export const PullRequestDescribeSchema = z.object({
  title: z
    .string()
    .describe('Your new PR title. Do not change it if it is already good.'),
  description: z.string().optional().describe('Your new PR description'),
  complexity: z
    .enum(['trivial', 'minor', 'major'])
    .describe('Your estimate of the complexity of the PR'),
});

export type PullRequestDescribe = z.infer<typeof PullRequestDescribeSchema>;

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
            Use proper English grammar and punctuation like a native speaker.
            Keep your output concise and relevant.
            ${options?.template ? `Follow the following template in your response as closely as possible:\n<template>\n${options.template}\n</template>` : ''}
            `;
            break;
          }
          case 'product': {
            system = dedent`
            You are a highly experienced product manager tasked with summarizing the latest release for the rest of the product org.
            Use the given context to generate a summary that will be used in a product update.
            Use proper English grammar and punctuation like a native speaker.
            Keep your output concise and relevant.
            ${options?.template ? `Follow the following template in your response as closely as possible:\n<template>\n${options.template}\n</template>` : ''}
            `;
            break;
          }
          case 'leadership': {
            system = dedent`
            You are a highly product manager tasked with summarizing the latest release for leadership.
            Use the given context to generate a summary that will be shown to company leadership.
            Use proper English grammar and punctuation like a native speaker.
            Keep your output concise and relevant.
            ${options?.template ? `Follow the following template in your response as closely as possible:\n<template>\n${options.template}\n</template>` : ''}
            `;
            break;
          }
          default: {
            system = dedent`
            You are an expert software engineer tasked with creating a detailed changelog of the release for other engineers.
            Use the given context to generate release notes that will be shown on the repository releases page.
            Use proper English grammar and punctuation like a native speaker.
            Keep your output concise and relevant.
            ${options?.template ? `Follow the following template in your response as closely as possible:\n<template>\n${options.template}\n</template>` : ''}
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
          options?.prompt
            ? dedent`
            Extra instructions:
            ${options.prompt}
            `
            : ''
        }
        `;

        logger.debug({ message: system });
        logger.debug({ message: prompt });

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
            files: PullRequestFileContext[];
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
        Use proper English grammar and punctuation like a native speaker.
        DO NOT RETURN A DESCRIPTION if you lack enough context.
        DO NOT RETURN A DESCRIPTION if the description is already good.
        Complexity is "trivial" if it touches only a few lines of code or configuration.
        Complexity is "minor" if it touches a few functions across one or two files.
        Complexity is "major" if it's a significant refactor or adds a huge new feature (hundreds of lines of code).
        ${options?.template ? `Follow the following template in your PR description as closely as possible:\n<template>\n${options.template}\n</template>` : ''}
        `;

        const prompt = dedent`
          Here's the relevant context:
          ${context.change.pr.prompt}
          <files>
          ${context.change.files.map((file) => file.prompt).join('\n')}
          </files>

          ${
            options?.prompt
              ? dedent`
            Extra instructions:
            ${options.prompt}
            `
              : ''
          }
          `;

        logger.debug({ message: system });
        logger.debug({ message: prompt });

        return await generateObject({
          model,
          schema: PullRequestDescribeSchema,
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
        Use proper English grammar and punctuation like a native speaker.
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

        logger.debug({ message: system });
        logger.debug({ message: prompt });

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
        Use proper English grammar and punctuation like a native speaker.
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

        logger.debug({ message: system });
        logger.debug({ message: prompt });

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
