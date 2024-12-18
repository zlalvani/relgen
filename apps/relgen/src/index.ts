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
    num: 2,
  },
  {
    template: dedent`
      ### Summary
      - **Changes:** What the PR updates
      - **Why:** Reason or problem solved

      ### Details
      - **Approach:** Brief implementation outline
      - **Affected Files:** Key files or modules

      ### Testing
      - **Steps:** How to test this PR
      - **Expected Outcome:** What should happen
    `,
    write: 'pr',
  }
);

console.log(result);
