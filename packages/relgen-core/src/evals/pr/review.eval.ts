import { Levenshtein } from 'autoevals';
import pino from 'pino';
import { createGithubClient } from '../../clients/github';
import { githubContextService } from '../../services/context/remote/github';
import { createLanguageModelService } from '../../services/llm';
import { parameterizedEval } from '../parameterize';

const logger = pino();

await parameterizedEval(
  (provider, model) => `Review PR (${provider} ${model})`,
  () => {
    // TODO: replace octokit with a stubbed version that uses fixtures
    const gh = createGithubClient({ token: '' });

    const context = githubContextService(gh, logger);

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
          logger
        );

        llm.pr.review(input);

        return input + ' World!';
      },
      // The scoring methods for the eval
      scorers: [Levenshtein],
    };
  }
);
