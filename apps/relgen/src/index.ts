#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { Option, program } from '@commander-js/extra-typings';
import { password, select } from '@inquirer/prompts';
import { type Relgen, createRelgen } from '@relgen/core';
import kleur from 'kleur';
import pino from 'pino';
import { toInt } from 'radashi';
import {
  type Config,
  anthropicModelChoices,
  configSchema,
  openaiModelChoices,
  providerChoices,
  providerModels,
} from './config/schema';

let relgen: Relgen;

let resolvedOpts: {
  provider: (typeof providerChoices)[number];
  model:
    | (typeof openaiModelChoices)[number]
    | (typeof anthropicModelChoices)[number];
  llmToken: string;
  logger?: pino.Logger;
};

let configFile: Config | undefined;

const log = (message: string) => {
  if (!cli.opts().silent) {
    console.log(message);
  }
};

const cli = program
  .name('relgen')
  .option('-t, --llm-token <token>', 'llm token')
  .option('-s, --silent', 'do not print output')
  .option('-c, --config <config>', 'config file')
  .addOption(
    new Option('-v, --verbose', 'verbose output (debug statements)').conflicts(
      'silent'
    )
  )
  .addOption(
    new Option('-p, --provider <provider>', 'llm provider').choices(
      providerChoices
    )
  )
  .addOption(
    new Option('-m, --model <model>', 'llm model').choices([
      ...openaiModelChoices,
      ...anthropicModelChoices,
    ])
  )
  .hook('preAction', async () => {
    let { llmToken, provider, model, verbose, config } = cli.opts();

    if (!config) {
      try {
        await access('.relgen.json');
        config = '.relgen.json';
      } catch {
        // ignore
      }
    }

    if (config) {
      configFile = configSchema.parse(
        JSON.parse(await readFile(config, 'utf-8'))
      );
    }

    provider =
      provider ||
      configFile?.llm?.provider ||
      (await select({
        message: 'Select LLM provider',
        choices: providerChoices.map((provider) => ({
          value: provider,
          name: provider,
        })),
      }));

    model =
      model ||
      configFile?.llm?.model ||
      (await select({
        message: 'Select LLM model',
        choices: providerModels[provider].map((model) => ({
          value: model,
          name: model,
        })),
      }));

    llmToken =
      llmToken ||
      (provider === 'openai' && process.env.OPENAI_API_KEY) ||
      (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) ||
      configFile?.llm?.apiKey ||
      (await password({
        message: 'Enter LLM token',
      }));

    resolvedOpts = {
      provider,
      model,
      llmToken,
      logger: verbose
        ? pino({
            level: 'debug',
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                messageKey: 'message',
              },
            },
          })
        : undefined,
    };

    relgen = createRelgen({
      llm: {
        apiKey: llmToken,
        provider,
        model,
      },
      logger: resolvedOpts.logger,
      integrations: {
        github: {
          token: '', // TODO: don't require github token
        },
      },
    });
  });

const remote = cli
  .command('remote')
  .option('-g, --github <token>', 'github token')
  .description('tasks relating to the code hosting platform')
  .hook('preAction', async () => {
    let { github: githubToken } = remote.opts();

    const { provider, model, llmToken, logger } = resolvedOpts;

    githubToken =
      githubToken ||
      process.env.GITHUB_TOKEN ||
      configFile?.integrations?.github?.token ||
      (await password({
        message: 'Enter GitHub token',
      }));

    relgen = createRelgen({
      llm: {
        apiKey: llmToken,
        provider,
        model,
      },
      logger,
      integrations: {
        github: {
          token: githubToken,
        },
      },
    });
  });

const parseIssueUrl = (url: URL) => {
  const [owner, repo, , number] = url.pathname.split('/').filter(Boolean);

  if (!owner || !repo || !number) {
    throw new Error('Invalid pull request URL');
  }

  return { owner, repo, num: toInt(number) };
};

const parseIssueArg = (arg: string) => {
  try {
    return parseIssueUrl(new URL(arg));
  } catch {
    return toInt(arg, null);
  }
};

const issue = remote.command('issue').description('tasks related to issues');

issue
  .command('label')
  .argument('<issue>', 'issue')
  .addOption(
    new Option('-w, --write <write>', 'update the labels').choices([
      'add',
      'set',
    ] as const)
  )
  .option(
    '--exclude <exclude>',
    'exclude "existing" or comma separated list',
    (val) => (val === 'existing' ? ('existing' as const) : val.split(','))
  )
  .description('label an issue')
  .action(async (issue, options) => {
    const { owner, repo, num } = parseIssueUrl(new URL(issue));

    const { write, exclude } = options;

    const result = await relgen.remote.issue.label(
      {
        owner,
        repo,
        num,
      },
      {
        write,
        exclude,
      }
    );

    if (result.labels.length > 0) {
      log(result.labels.join(', '));
    } else {
      log(kleur.red('No labels added'));
    }
  });

// Can be e.g. zlalvani/relgen or https://github.com/zlalvani/relgen
const parseRepoPath = (path: string) => {
  const [owner, repo] = path.split('/').filter(Boolean).slice(-2);

  if (!owner || !repo) {
    throw new Error('Invalid repository URL');
  }

  return { owner, repo };
};

const release = remote
  .command('release')
  .description('tasks related to releases');

release
  .command('describe')
  .argument('<repo>', 'repository')
  .option('--from <from>', 'tag of the previous release', 'latest' as const)
  .option('--to <to>', 'tag of the current release')
  .addOption(
    new Option('--persona <persona>', 'persona').choices([
      'marketing',
      'engineering',
      'product',
      'leadership',
    ] as const)
  )
  .option('--template <template>', 'template file')
  .option('--prompt <prompt>', 'prompt file')
  .addOption(
    new Option('--include <include...>', 'include').choices([
      'issues',
      'labels',
      'tickets',
      'all',
    ] as const)
  )
  .description('describe a release')
  .action(async (repoOrReleasePath, options) => {
    const { from, to } = options;
    const { owner, repo } = parseRepoPath(repoOrReleasePath);

    const {
      persona,
      template: templateFile,
      prompt: promptFile,
      include: includeArray,
    } = options;

    let template: string | undefined;
    let prompt: string | undefined;

    if (templateFile) {
      template = await readFile(templateFile, 'utf-8');
    }

    if (promptFile) {
      prompt = await readFile(promptFile, 'utf-8');
    }

    const includeSet = new Set(includeArray);

    const include = includeSet.has('all')
      ? 'all'
      : {
          issues: includeSet.has('issues'),
          tickets: includeSet.has('tickets'),
          labels: includeSet.has('labels'),
        };

    const result = await relgen.remote.release.describe(
      {
        owner,
        repo,
        fromTag: from,
        toTag: to,
      },
      {
        include,
        persona,
        template,
        prompt,
      }
    );

    if (result) {
      log(result.description);
    } else {
      log(kleur.red('No changes found'));
    }
  });

const pr = remote.command('pr').description('tasks related to pull requests');

pr.command('describe')
  .argument('<pr>', 'pull request')
  .addOption(
    new Option('-w, --write <write>', 'persona').choices([
      'pr',
      'comment',
    ] as const)
  )
  .option('--footer <footer>', 'footer')
  .option('--template <template>', 'template file')
  .option('--prompt <prompt>', 'prompt file')
  .description('describe a pull request')
  .action(async (pr, options) => {
    // TODO: support numbers alone when we have gh cli support
    const { owner, repo, num } = parseIssueUrl(new URL(pr));

    const {
      write,
      template: templateFile,
      prompt: promptFile,
      footer,
    } = options;

    let template: string | undefined;
    let prompt: string | undefined;

    if (templateFile) {
      template = await readFile(templateFile, 'utf-8');
    }

    if (promptFile) {
      prompt = await readFile(promptFile, 'utf-8');
    }

    const result = await relgen.remote.pr.describe(
      {
        owner,
        repo,
        num,
      },
      {
        write,
        template,
        prompt,
        footer,
      }
    );

    if (result.description) {
      log(result.description);
    } else {
      log(kleur.red('No description was generated'));
    }
  });

pr.command('label')
  .argument('<pr>', 'pull request')
  .addOption(
    new Option('-w, --write <write>', 'update the labels').choices([
      'add',
      'set',
    ] as const)
  )
  .option(
    '--exclude <exclude>',
    'exclude "existing" or comma separated list',
    (val) => (val === 'existing' ? ('existing' as const) : val.split(','))
  )
  .description('label a pull request')
  .action(async (pr, options) => {
    const { owner, repo, num } = parseIssueUrl(new URL(pr));

    const { write, exclude } = options;

    const result = await relgen.remote.pr.label(
      {
        owner,
        repo,
        num,
      },
      {
        write,
        exclude,
      }
    );

    if (result.labels.length > 0) {
      log(result.labels.join(', '));
    } else {
      log(kleur.red('No labels added'));
    }
  });

await cli.parseAsync();
