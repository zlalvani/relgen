import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { RelgenOptions } from '..';

export const languageModelService = (model: LanguageModel) => {
  return {};
};

export const injectLanguageModelService = (options: RelgenOptions['model']) => {
  const { apiKey } = options;

  switch (options.provider) {
    case 'openai': {
      return createOpenAI({ apiKey }).chat(options.modelId);
    }
    case 'anthropic': {
      return createAnthropic({ apiKey }).languageModel(options.modelId);
    }
    default: {
      throw new Error('Invalid model provider');
    }
  }
};

export type LanguageModelService = ReturnType<typeof languageModelService>;
