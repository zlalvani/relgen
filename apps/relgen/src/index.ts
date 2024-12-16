import { createRelgen } from 'relgen-core';

const relgen = createRelgen({
  llmApiKey: 'my-api-key',
  model: {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
  },
});
