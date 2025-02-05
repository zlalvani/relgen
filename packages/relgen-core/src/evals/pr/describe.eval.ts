import { Levenshtein } from 'autoevals';
import pino from 'pino';
import { createLanguageModelService } from '../../services/llm';
import { parameterizedEval } from '../parameterize';

parameterizedEval(
  (provider, model) => `Describe PR (${provider} ${model})`,
  () => {
    return [
      {
        input: {
          pr: {
            type: 'pr',
            data: {},
            prompt: 'Review PR',
          },
          files: [],
          rules: [],
        },
        expected: 'Hello World!',
      },
    ] as const;
  },
  (provider, model) => {
    return {
      // The task to perform
      // - TODO: Replace with your LLM call
      task: (input) => {
        const llm = createLanguageModelService(
          {
            provider,
            model,
            apiKey: '',
          },
          pino()
        );

        llm.pr.review(input);

        return input + ' World!';
      },
      // The scoring methods for the eval
      scorers: [Levenshtein],
    };
  }
);
