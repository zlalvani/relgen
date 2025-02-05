import { Levenshtein } from 'autoevals';
import pino from 'pino';
import { createLanguageModelService } from '../../services/llm';
import { parameterizedEval } from '../parameterize';

parameterizedEval(
  (provider, model) => `Review PR (${provider} ${model})`,
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
      // A function that returns an array of test data
      // - TODO: Replace with your test data
      // data: () => {
      //   return [
      //     {
      //       input: {} as Parameters<
      //         ReturnType<typeof createLanguageModelService>['pr']['review']
      //       >,
      //       expected: 'Hello World!',
      //     },
      //   ] as const;
      // },
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
