import dedent from 'dedent';
import { createRelgen } from 'relgen-core';

const relgen = createRelgen({
  model: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
  },
  integrations: {
    github: {
      token: process.env.GH_TOKEN ?? '',
    },
    linear: {
      token: 'my-linear',
    },
  },
});

const result = await relgen.pr.describe(
  {
    owner: 'zlalvani',
    repo: 'relgen',
    num: 8,
  },
  {
    template: dedent`
      ### Summary
      - **Changes:** What the PR updates
      - **Approach:** How the PR solves the problem

      ### Testing
      - **Steps:** How to test this PR
    `,
    write: 'pr',
  }
);

console.log(result);

// const labelResult = await relgen.issue.label(
//   {
//     owner: 'sindresorhus',
//     repo: 'type-fest',
//     num: 950,
//   },
//   {
//     // write: 'replacing',
//     write: false,
//     exclude: ['help wanted'],
//     prompt: dedent`
//     Prefer the "type addition" label instead of "enhancement" if the issue is suggesting a new type.
//     Label something as a question if it's just asking a question or the user seems confused.
//     `,
//   }
// );

// // Prefer the "type addition" label instead of "enhancement" if the PR adds a new type definition.
// // Don't label something as a bug if it's just asking a question or the user seems confused.
// console.log(labelResult);

// const prLabelResult = await relgen.pr.label(
//   {
//     owner: 'zlalvani',
//     repo: 'relgen',
//     num: 7,
//   },
//   {
//     // write: 'replacing',
//     write: 'replacing',
//     exclude: ['help wanted'],
//     prompt: dedent`
//     Add the testing label if the PR is related to testing.
//     Add the enhancement label as an extra if the PR is about improving something, e.g. testing + enhancement.
//     `,
//   }
// );

// console.log(prLabelResult);

// const releaseResult = await relgen.release.describe({
//   owner: 'sindresorhus',
//   repo: 'type-fest',
// });

const releaseResult = await relgen.release.describe(
  {
    owner: 'dottxt-ai',
    repo: 'outlines',
  },
  {
    include: 'all',
    persona: 'leadership',
  }
);

console.log(releaseResult);
