import { JSONDiff, Levenshtein } from 'autoevals';
import { parameterizedEval } from '../parameterize';

await parameterizedEval(
  ({ provider, model }) => `Review PR (${provider} ${model})`,
  async ({ deps }) => {
    const { context } = deps;

    const { owner, repo, num } = {
      owner: 'lavalink-devs',
      repo: 'youtube-source',
      num: 98,
    };

    return [
      {
        input: {
          pr: (
            await context.pr.get({
              owner,
              repo,
              num,
            })
          ).pr,
          files: await context.pr.files({ owner, repo, num }),
          rules: [
            'Follow generally accepted best practices, but do not nitpick.',
          ],
        },
        expected: {},
      },
    ] as const;
  },
  ({ deps }) => {
    return {
      // The task to perform
      // - TODO: Replace with your LLM call
      task: async (input) => {
        const { llm } = deps;

        const review = await llm.pr.review(input);

        return review;
      },
      // The scoring methods for the eval
      scorers: [
        JSONDiff.partial({
          stringScorer: Levenshtein,
        }),
      ],
    };
  }
);
