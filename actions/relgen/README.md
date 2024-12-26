# Relgen PR Assistant Action

This action uses [relgen](https://github.com/zlalvani/relgen) to automatically generate descriptive comments for pull requests and intelligently label them using AI.

## Features

- 🤖 AI-powered PR descriptions
- 🏷️ Intelligent PR labeling
- ⚙️ Customizable templates and prompts
- 🔄 Updates on PR changes

## Usage

```yaml
name: PR Assistant
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  relgen:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: zlalvani/relgen@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          llm-key: ${{ secrets.OPENAI_API_KEY }} # or ANTHROPIC_API_KEY
          llm-provider: openai # or anthropic
          llm-model: gpt-4o-mini # or claude-3-sonnet-20240229 etc
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | N/A |
| `llm-key` | LLM API key (OpenAI or Anthropic) | Yes | N/A |
| `llm-provider` | LLM provider (`openai` or `anthropic`) | Yes | `openai` |
| `llm-model` | Model to use (e.g. `gpt-4o-mini` for OpenAI or `claude-3-sonnet-20240229` for Anthropic) | Yes | N/A |
| `description-template` | Path to description template file | No | Default template |
| `description-prompt` | Path to description prompt file | No | Default prompt |
| `write-mode` | How to write descriptions (`pr` or `comment`) | No | `comment` |
| `label-mode` | How to write labels (`add` or `set`) | No | `add` |

## Customization

### Templates

Create a markdown template file (e.g. `.github/templates/pr-description.md`):

```markdown
### Changes
A bullet point list of the important changes

### Implementation
Technical details of the implementation

### Other Notes
Additional context or minor changes
```

### Prompts

Create a prompt file (e.g. `.github/prompts/pr-description.txt`):

```
Focus on the technical impact of the changes.
Highlight any breaking changes.
Include performance implications.
```

Then update your workflow:

```yaml
- uses: zlalvani/relgen@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    llm-key: ${{ secrets.OPENAI_API_KEY }} # or ANTHROPIC_API_KEY
    llm-provider: openai # or anthropic
    llm-model: gpt-4o-mini # or claude-3-sonnet-20240229 etc
    description-template: .github/templates/pr-description.md
    description-prompt: .github/prompts/pr-description.txt
```

## License

MIT
