import { createRelgen } from 'relgen-core';

const relgen = createRelgen({
  model: {
    apiKey: 'my-api-key',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
  },
});
