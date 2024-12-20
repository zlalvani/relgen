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
