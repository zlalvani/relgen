## Quick Start

```typescript
import { createRelgen } from 'relgen';

const relgen = createRelgen({
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4'
  }
});

// Generate release notes for all PRs since the last release
const notes = await relgen.remote.release.describe({
  owner: 'org',
  repo: 'repo'
});

// Generate PR description
const description = await relgen.remote.pr.describe({
  owner: 'org',
  repo: 'repo',
  num: 123
}, {
  write: 'pr' // or 'comment' to post as comment
});

// Auto-label issues
const labels = await relgen.remote.issue.label({
  owner: 'org',
  repo: 'repo', 
  num: 456
}, {
  write: 'add' // or 'set' to replace existing labels
});
```