# Relgen 📝

AI-powered release notes that write themselves from your PRs and issues.

## Features

- 🤖 AI-powered release notes generation
- 🔄 Integration with GitHub for PR and issue context
- 🎯 Linear integration for ticket tracking
- ⚡ Support for multiple LLM providers (OpenAI, Anthropic)
- 🛠️ Customizable templates and prompts
- 📦 Modular architecture with TypeScript

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

3. Generate release notes:

```typescript
const releaseNotes = await relgen.generate({
  // Your generation options here
});
```

## CLI Usage

Relgen also comes with a convenient CLI tool. After installation, you can use it directly from your terminal:

```bash
# Generate release notes for the latest changes
relgen generate

# Generate notes for a specific PR
relgen generate --pr 123

# Generate notes with a custom template
relgen generate --template release-template.md

# Generate notes for a date range
relgen generate --from 2024-01-01 --to 2024-01-31

# Use a specific LLM provider
relgen generate --provider anthropic

# Get help
relgen --help
```

You can also create a configuration file `.relgenrc.json` in your project root:

```json
{
  "provider": "openai",
  "model": "gpt-4",
  "template": "./templates/custom-template.md",
  "githubToken": "${GITHUB_TOKEN}"
}
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
