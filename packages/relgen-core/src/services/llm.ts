import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAI } from '@ai-sdk/openai';
import { type LanguageModel, generateObject } from 'ai';
import type pino from 'pino';
import { dedent } from 'radashi';
import { z } from 'zod';
import type { RelgenOptions } from '..';
import type {
  DiffContext,
  IssueContext,
  LabelContext,
  PullRequestContext,
  PullRequestFileContext,
  TicketContext,
} from '../services/context';

export const PullRequestDescribeSchema = z.object({
  title: z
    .string()
    .describe('Your new PR title. Do not change it if it is already good.'),
  complexity: z
    .enum(['trivial', 'minor', 'major'])
    .describe('Your estimate of the complexity of the PR'),
  description: z.string().optional().describe('Your new PR description'),
});

export type PullRequestDescribe = z.infer<typeof PullRequestDescribeSchema>;

export const languageModelService = (
  model: LanguageModel,
  logger: pino.Logger
) => {
  return {
    repo: {
      patterns: {
        structure: async () => {},
        code: async () => {},
      },
    },
    release: {
      describe: async (
        context: {
          changes: {
            pr: PullRequestContext;
            labels: LabelContext[];
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
            ${change.labels.map((label) => label.prompt).join('\n')}
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
      review: async (
        context: {
          pr: PullRequestContext;
          files: PullRequestFileContext[];
          rules: string[];
        },
        options?: {
          extraInstructions?: string;
        }
      ) => {
        const { pr, files, rules } = context;

        const system = dedent`
        You are an expert software engineer tasked with reviewing a pull request to ensure it follows some given rules.
        Use proper English grammar and punctuation like a native speaker.
        Refer to files by the file context ID given in the prompt.
        Patches are provided, these include preceding '+' or '-' characters to indicate added or removed lines.
        When providing line context, print the relevant line verbatim.
        You may include multiple reviews for the same file if necessary.
        Return an empty array of reviews if there are no important issues to address.
        Use the given context to review the PR, following the rules given.
        Make sure to explain each review comment clearly and concisely.
        If no change is needed, do not include a review.
        DO NOT MENTION ISSUES UNRELATED TO THE GIVEN RULES.
        `;

        const prompt = dedent`
          Here's the PR context:
          ${pr.prompt}
          
          <files>
          ${files
            .map((file, id) => {
              return dedent`
              <file-context id=${id}>
              ${file.prompt}
              </file-context>
              `;
            })
            .join('\n')}
          </files>

          <rules>
            ${rules.map((rule) => `<rule>\n${rule}\n<rule>`).join('\n')}
          </rules>

          ${options?.extraInstructions ? `Extra instructions: \n${options.extraInstructions}` : ''}
          `;

        logger.debug({ message: system });
        logger.debug({ message: prompt });

        return await generateObject({
          model,
          schema: z.object({
            summary: z
              .string()
              .optional()
              .describe(
                'The summary to be left on the PR as a comment. Keep it short.'
              ),
            reviews: z
              .array(
                z.object({
                  fileContextId: z
                    .number()
                    .describe(
                      'The ID of the file context as given in the prompt (can be repeated if the review lines do not overlap)'
                    ),
                  line: z
                    .string()
                    .describe(
                      'The line the review is about. Be sure to include the leading "+" or "-" character if present.'
                    ),
                  occurrence: z
                    .number()
                    .default(0)
                    .describe(
                      'If the line occurs multiple times, which one is it? (0-indexed)'
                    ),
                  comment: z
                    .string()
                    .describe(
                      'The specific review feedback for the selected context. This is different from the top level comment.'
                    ),
                })
              )
              .describe(
                'The list of reviews to be left on the PR. If a change looks good, do not include a review.'
              ),
          }),
          system,
          prompt,
        });
      },
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
        const template =
          options?.template ??
          dedent`
        ### Changes
        A bullet point list of the important changes, one sentence each

        ### Implementation
        ONLY INCLUDED IF THE CHANGES ARE "major" COMPLEXITY.
        If the changes are "major" complexity, use this section to explain the context and approach at a high level in a few sentences. If they are not "major", omit this section.

        ### Other Notes
        ONLY INCLUDED IF THERE ARE CHANGES UNRELATED TO ANYTHING DESCRIBED ABOVE.
        If there are small tweaks to things unrelated to the main purpose of the PR, highlight them here in a bullet point list.
        If there are no small tweaks, omit this section.
        One sentence each.
        Do not repeat yourself in this section; if a change is mentioned in the "Changes" section, it does not need to be mentioned here.
        `;

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
        Follow the following template in your PR description as closely as possible:\n<template>\n${template}\n</template>
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
    case 'deepseek': {
      return languageModelService(
        createDeepSeek({ apiKey }).languageModel(options.model),
        logger
      );
    }
    default: {
      throw new Error('Invalid model provider');
    }
  }
};

export type LanguageModelService = ReturnType<typeof languageModelService>;
export type GeneratedIssueLabel = Awaited<
  ReturnType<LanguageModelService['issue']['label']>
>;
export type GeneratedPullRequestLabel = Awaited<
  ReturnType<LanguageModelService['pr']['label']>
>;
export type GeneratedPullRequest = Awaited<
  ReturnType<LanguageModelService['pr']['describe']>
>;
export type GeneratedPullRequestReview = Awaited<
  ReturnType<LanguageModelService['pr']['review']>
>;
