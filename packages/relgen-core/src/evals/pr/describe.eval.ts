import { Levenshtein } from 'autoevals';
import { parameterizedEval } from '../parameterize';

await parameterizedEval(
  ({ provider, model }) => `Describe PR (${provider} ${model})`,
  () => {
    return [
      {
        input: 'hi',
        expected: 'Hello World!',
      },
    ] as const;
  },
  () => {
    return {
      // The task to perform
      // - TODO: Replace with your LLM call
      task: () => {
        return 'Hello';
      },
      // The scoring methods for the eval
      scorers: [Levenshtein],
    };
  }
);
