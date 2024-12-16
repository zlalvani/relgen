import { createAnthropic } from '@ai-sdk/anthropic';
import type { AnthropicMessagesModelId } from '@ai-sdk/anthropic/internal';
import { createOpenAI } from '@ai-sdk/openai';
import type { OpenAIChatModelId } from '@ai-sdk/openai/internal';
import { type LanguageModel, generateText } from 'ai';

export type RelgenOptions = {
  llmApiKey: string;
  model:
    | {
        provider: 'openai';
        modelId: OpenAIChatModelId;
      }
    | {
        provider: 'anthropic';
        modelId: AnthropicMessagesModelId;
      };
  template?: string;
};

const relgen = ({
  model,
}: {
  model: LanguageModel;
  template?: string;
}) => {
  return {
    generate: async () => {
      return await generateText({
        model,
        prompt: 'Generate some release notes',
      });
    },
  };
};

export const createRelgen = (options: RelgenOptions) => {
  const { llmApiKey, template } = options;

  let model: LanguageModel;

  switch (options.model.provider) {
    case 'openai': {
      model = createOpenAI({ apiKey: llmApiKey }).chat(options.model.modelId);
      break;
    }
    case 'anthropic': {
      model = createAnthropic({ apiKey: llmApiKey }).languageModel(
        options.model.modelId
      );
      break;
    }
    default: {
      throw new Error('Invalid model provider');
    }
  }

  return relgen({
    model,
    template,
  });
};

export type Relgen = ReturnType<typeof createRelgen>;
