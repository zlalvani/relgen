import { Levenshtein } from 'autoevals';
import pino from 'pino';
import { createGithubClient } from '../../clients/github';
import { githubContextService } from '../../services/context/remote/github';
import { createLanguageModelService } from '../../services/llm';
import { config } from '../config';
import { parameterizedEval } from '../parameterize';

const logger = pino({ level: config.logger.level });

await parameterizedEval(
  (provider, model) => `Review PR (${provider} ${model})`,
  async () => {
    // TODO: replace octokit with a stubbed version that uses fixtures
    const gh = createGithubClient({ token: config.github.token });
    const context = githubContextService(gh, logger);

    return [
      {
        input: {
          pr: (
            await context.pr.get({
              owner: 'zlalvani',
              repo: 'relgen',
              num: 132,
            })
          ).pr,
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
      task: async (input) => {
        const llm = createLanguageModelService(
          {
            provider,
            model,
            apiKey: config[provider].apiKey,
          },
          logger
        );

        const review = await llm.pr.review(input);

        return JSON.stringify(review);
      },
      // The scoring methods for the eval
      scorers: [Levenshtein],
    };
  }
);
