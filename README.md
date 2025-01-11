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
- 📦 Scriptable with bash or typescript (via @relgen/core)

## Installation

```bash
npm install -g relgen
# or
pnpm add -g relgen
# or
yarn global add relgen
```

## CLI Usage

```bash
# Generate release notes
relgen remote release describe owner/repo

# Analyze contributions in a release
relgen remote release ascribe owner/repo --from v1.0.0 --to v1.1.0

# Generate PR description
relgen remote pr describe owner/repo 123

# Auto-label a PR
relgen remote pr label owner/repo 456

# Auto-label an issue
relgen remote issue label owner/repo 789

# Analyze repository contributions
relgen remote ascribe owner/repo --range "last month"

# Use different LLM providers
relgen remote release describe owner/repo --provider anthropic

# Write results back to GitHub
relgen remote pr describe owner/repo 123 --write pr
relgen remote pr label owner/repo 456 --write add

# Use custom templates/prompts
relgen remote release describe owner/repo --template custom.md
relgen remote pr describe owner/repo 123 --prompt custom-prompt.txt

# Get help
relgen --help
```

## Github Action

```yaml
name: Relgen
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  relgen:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v4
      - uses: zlalvani/relgen-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          llm-key: ${{ secrets.OPENAI_API_KEY }} # or ANTHROPIC_API_KEY
          llm-provider: openai # or anthropic
          llm-model: gpt-4o-mini # or claude-3-sonnet-20240229 etc
```

For more documentation on the github action, please see its [README](https://github.com/zlalvani/relgen-action).

## Configuration

Relgen can be configured through environment variables or a `.relgen.json` file. Any required variables that aren't provided will be requested via CLI prompt.

### Environment Variables
```bash
# Set up your LLM provider
export OPENAI_API_KEY="your-api-key"
# or for Anthropic
export ANTHROPIC_API_KEY="your-api-key"

# GitHub access
export GITHUB_TOKEN="your-github-token"

# Linear integration
export LINEAR_API_KEY="your-linear-token"
```

### Configuration File
Create a `.relgen.json` in your project root:

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
    },
    "linear": {
      "token": "${LINEAR_API_KEY}" 
    }
  }
}
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add a changeset to document your changes:
   ```bash
   pnpm changeset
   ```
   This will prompt you to:
   - Select which packages you've modified
   - Choose a semver bump type (major/minor/patch)
   - Provide a description of your changes
5. Commit your changes and changeset:
   ```bash
   git add .
   git commit -m 'feat: Add some amazing feature'
   ```
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a PR

The changeset will be automatically used to update the package version and changelog when your PR is merged.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you have any questions or need help, please:
- Open an issue
- Start a GitHub Discussion
