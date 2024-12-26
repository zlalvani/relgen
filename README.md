# Relgen 📝

AI-powered tool for GitHub repositories that automatically generates release notes, writes pull request descriptions, and intelligently applies labels to issues and PRs.

## Features

- 🤖 AI-powered content generation for:
  - Release notes
  - Pull request descriptions
  - Issue labeling and categorization
- 🔄 Smart GitHub integration for PR and issue context
- 🎯 Linear integration for ticket tracking
- ⚡ Support for multiple LLM providers (OpenAI, Anthropic)
- 🛠️ Customizable templates and prompts
- 📦 Modular architecture with TypeScript

## CLI Usage

Relgen provides a CLI tool for easy access to its features:

```bash
# Generate release notes
relgen remote release describe owner/repo

# Generate PR description
relgen remote pr describe owner/repo 123

# Auto-label a PR
relgen remote pr label owner/repo 456

# Auto-label an issue
relgen remote issue label owner/repo 789

# Use different LLM providers
relgen remote release describe owner/repo --llm.provider anthropic

# Write results back to GitHub
relgen remote pr describe owner/repo 123 --write pr
relgen remote pr label owner/repo 456 --write add

# Use custom templates/prompts
relgen remote release describe owner/repo --template custom.md
relgen remote pr describe owner/repo 123 --prompt custom-prompt.txt

# Get help
relgen --help
relgen release describe --help
relgen pr describe --help
relgen issue label --help
```

Configuration can be provided via environment variables or a `.relgen.json` file:

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4",
    "apiKey": "${OPENAI_API_KEY}"
  },
  "integrations": {
    "github": {
      "token": "${GITHUB_TOKEN}"
    }
  }
}
```

## Installation

```bash
npm install relgen
# or
pnpm add relgen
# or
yarn add relgen
```

## Quick Start

1. Set up your environment variables:
```bash
export OPENAI_API_KEY="your-api-key"
# or for Anthropic
export ANTHROPIC_API_KEY="your-api-key"
```

2. Create a basic configuration:

```typescript
import { createRelgen } from 'relgen';

const relgen = createRelgen({
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4'
  }
});
```

3. Use Relgen:

```typescript
// Generate release notes
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

## Documentation

For detailed documentation, check out:

- [Configuration Guide](docs/configuration.md)
- [API Reference](docs/api.md)
- [Templates](docs/templates.md)
- [Examples](apps/relgen/examples)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you have any questions or need help, please:
- Open an issue
- Start a GitHub Discussion
- Check the documentation

## Acknowledgments

Thanks to all contributors who have helped shape Relgen!
