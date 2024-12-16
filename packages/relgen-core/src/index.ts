import { createOpenAI } from '@ai-sdk/openai';
import { type LanguageModel, generateText } from 'ai';

export type RelgenOptions = {
  llmApiKey: string;
};

const relgen = ({
  model,
}: {
  model: LanguageModel;
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

export const createRelgen = ({ llmApiKey }: RelgenOptions) => {
  const model = createOpenAI({ apiKey: llmApiKey }).chat(
    'gpt-4o-mini-2024-07-18'
  );

  return relgen({
    model,
  });
};

export type Relgen = ReturnType<typeof createRelgen>;
