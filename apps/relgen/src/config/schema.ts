import { Minimatch } from 'minimatch';
import { z } from 'zod';

export const providerChoices = ['openai', 'anthropic', 'deepseek'] as const;
export const openaiModelChoices = [
  'o1-preview',
  'o1-mini',
  'o3-mini',
  'gpt-4o',
  'gpt-4o-2024-05-13',
  'gpt-4o-2024-08-06',
  'gpt-4o-2024-11-20',
  'gpt-4o-audio-preview',
  'gpt-4o-audio-preview-2024-10-01',
  'gpt-4o-mini',
] as const;
export const anthropicModelChoices = [
  'claude-3-5-sonnet-latest',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-20240620',
  'claude-3-5-haiku-latest',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-latest',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
] as const;
export const deepseekModelChoices = [
  'deepseek-chat',
  'deepseek-reasoner',
] as const;

export const providerModels = {
  openai: openaiModelChoices,
  anthropic: anthropicModelChoices,
  deepseek: deepseekModelChoices,
} as const;

// from https://github.com/colinhacks/zod/discussions/2790
function unionOfLiterals<T extends string | number>(constants: readonly T[]) {
  const literals = constants.map((x) => z.literal(x)) as unknown as readonly [
    z.ZodLiteral<T>,
    z.ZodLiteral<T>,
    ...z.ZodLiteral<T>[],
  ];
  return z.union(literals);
}

const globSchema = z
  .string()
  .transform((val) => new Minimatch(val))
  .refine((val) => !!val.makeRe(), { message: 'Invalid blob pattern' });

const stringOrFileSchema = z.union([
  z.string(),
  z.object({ file: z.string() }),
]);

export const configSchema = z.object({
  llm: z
    .union([
      z.object({
        provider: z.literal('openai'),
        model: unionOfLiterals(openaiModelChoices),
        apiKey: z.string().optional(),
      }),
      z.object({
        provider: z.literal('anthropic'),
        model: unionOfLiterals(anthropicModelChoices),
        apiKey: z.string().optional(),
      }),
      z.object({
        provider: z.literal('deepseek'),
        model: unionOfLiterals(deepseekModelChoices),
        apiKey: z.string().optional(),
      }),
    ])
    .optional(),
  integrations: z
    .object({
      github: z
        .object({
          token: z.string(),
        })
        .optional(),
      linear: z
        .object({
          token: z.string(),
        })
        .optional(),
    })
    .optional(),
  commands: z
    .object({
      remote: z
        .object({
          pr: z
            .object({
              describe: z
                .object({
                  template: stringOrFileSchema.optional(),
                  prompt: stringOrFileSchema.optional(),
                  excludedFilePatterns: z.array(globSchema).optional(),
                })
                .optional(),
              review: z
                .object({
                  ruleEvalMode: z.enum(['together', 'separate']).optional(),
                  fileEvalMode: z.enum(['together', 'separate']).optional(),
                  excludedFilePatterns: z.array(globSchema).optional(),
                  rules: z.array(stringOrFileSchema).optional(),
                })
                .optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

export type Config = z.infer<typeof configSchema>;
