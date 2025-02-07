import { z } from 'zod';

const envSchema = z.object({
  GITHUB_TOKEN: z.string(),
  OPENAI_API_KEY: z.string(),
  ANTHROPIC_API_KEY: z.string(),
  DEEPSEEK_API_KEY: z.string(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
});

const env = envSchema.parse(process.env);

export const config = {
  github: {
    token: env.GITHUB_TOKEN,
  },
  openai: {
    apiKey: env.OPENAI_API_KEY,
  },
  anthropic: {
    apiKey: env.ANTHROPIC_API_KEY,
  },
  deepseek: {
    apiKey: env.DEEPSEEK_API_KEY,
  },
  logger: {
    level: env.LOG_LEVEL ?? 'info',
  },
};
