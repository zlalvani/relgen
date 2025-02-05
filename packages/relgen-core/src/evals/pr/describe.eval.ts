import { Levenshtein } from 'autoevals';
import { parameterizedEval } from '../parameterize';

parameterizedEval((provider, name) => `Describe PR (${provider} ${name})`, {
  // A function that returns an array of test data
  // - TODO: Replace with your test data
  data: async () => {
    return [{ input: 'Hello', expected: 'Hello World!' }];
  },
  // The task to perform
  // - TODO: Replace with your LLM call
  task: async (input) => {
    return input + ' World!';
  },
  // The scoring methods for the eval
  scorers: [Levenshtein],
});
