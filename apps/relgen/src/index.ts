#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { Option, program } from '@commander-js/extra-typings';
import { password, select } from '@inquirer/prompts';
import { type Relgen, createRelgen } from '@relgen/core';
import * as chrono from 'chrono-node/en';
import kleur from 'kleur';
import pino from 'pino';
import { dedent, toInt } from 'radashi';
import { z } from 'zod';
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

const output = <T extends object>(obj: T, serialize?: (obj: T) => string) => {
  if (!cli.opts().silent) {
    if (cli.opts().json) {
      console.log(JSON.stringify(obj));
    } else {
      console.log(serialize ? serialize(obj) : obj);
    }
  }
};

const cli = program
  .name('relgen')
  .option('-t, --llm-token <token>', 'llm token')
  .option('-s, --silent', 'do not print output')
  .option('-c, --config <config>', 'config file')
  .option('--json', 'output as json')
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
        JSON.parse((await readFile(config, 'utf-8')).trim())
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

const parseRepoArgs = (first: string, second: string | undefined) => {
  if (!!first && !!second) {
    return { owner: first, repo: second };
  }

  const [owner, repo] = first.split('/').filter(Boolean).slice(-2);

  if (!owner || !repo) {
    throw new Error('Invalid repository');
  }

  return { owner, repo };
};

const parseIssueArgs = (
  first: string,
  second: string | undefined,
  third: number | undefined
) => {
  if (!!first && !!second && !!third) {
    return { owner: first, repo: second, num: third };
  }

  if (!!first && !!second) {
    const [owner, repo] = first.split('/').filter(Boolean).slice(-2);
    const num = toInt(second, undefined);

    if (!owner || !repo || !num) {
      throw new Error('Invalid issue definition');
    }

    return { owner, repo, num };
  }

  const url = new URL(first);

  const [owner, repo, , num] = url.pathname.split('/').filter(Boolean);

  if (!owner || !repo || !num) {
    throw new Error('Invalid pull request URL');
  }

  return { owner, repo, num: toInt(num) };
};

remote
  .command('ascribe')
  .argument('<owner>', 'owner or owner/repo')
  .argument('[repo]', 'repo')
  .option('--range <range>', 'a natural language time range (uses chrono-node)')
  .option(
    '--excluded-pattern <pattern>',
    'regex pattern to exclude PRs',
    (val) => new RegExp(val)
  )
  .option(
    '--excluded-contexts <excluded-contexts>',
    'which contexts to exclude, for smaller context windows (file-content)',
    (val) => z.array(z.enum(['file-content'])).parse(val.split(','))
  )
  .action(async (first, second, options) => {
    const { owner, repo } = parseRepoArgs(first, second);

    let from: Date | undefined, to: Date | undefined;
    const { excludedPattern, range, excludedContexts } = options;

    if (range) {
      const parsed = chrono.parse(range);

      if (parsed[0]) {
        from = parsed[0].start.date();
        to = parsed[0].end?.date();
      }
    }

    const result = await relgen.remote.ascribe(
      {
        owner,
        repo,
        from,
        to,
      },
      {
        excludedPattern,
        excludedContexts,
      }
    );

    if (result) {
      output(result, (result) => {
        const lines: string[] = [];

        for (const { author, items } of result) {
          lines.push(`## ${author}`);
          for (const item of items) {
            lines.push(`- ${item.pr.title}: ${item.pr.url}`);
            lines.push(`  ${item.relgen.complexity}`);
          }
        }

        return lines.join('\n');
      });
    } else {
      output([], () => kleur.red('No changes found'));
    }
  });

const issue = remote.command('issue').description('tasks related to issues');

issue
  .command('label')
  .argument('<owner>', 'issue URL or owner/repo or owner')
  .argument('[repo]', 'repository or issue number')
  .argument('[number]', 'issue number', (val) => toInt(val, undefined))
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
  .action(async (first, second, third, options) => {
    const { owner, repo, num } = parseIssueArgs(first, second, third);

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

    output(result, (result) =>
      result.labels.length
        ? result.labels.join(', ')
        : kleur.red('No labels added')
    );
  });

const release = remote
  .command('release')
  .description('tasks related to releases');

release
  .command('describe')
  .argument('<repo>', 'owner or owner/repo')
  .argument('[repo]', 'repo')
  .option('--from <from>', 'tag of a release')
  .option('--to <to>', 'tag of a release')
  .addOption(
    new Option('--unreleased', 'use all unreleased PRs').conflicts([
      'to',
      'from',
    ])
  )
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
      'tickets',
      'all',
    ] as const)
  )
  .description('describe a release (if no tags are provided, all PRs are used)')
  .action(async (first, second, options) => {
    const { from, to, unreleased } = options;
    const { owner, repo } = parseRepoArgs(first, second);

    const {
      persona,
      template: templateFile,
      prompt: promptFile,
      include: includeArray,
    } = options;

    let template: string | undefined;
    let prompt: string | undefined;

    if (templateFile) {
      template = (await readFile(templateFile, 'utf-8')).trim();
    }

    if (promptFile) {
      prompt = (await readFile(promptFile, 'utf-8')).trim();
    }

    const includeSet = new Set(includeArray);

    const include = includeSet.has('all')
      ? 'all'
      : {
          issues: includeSet.has('issues'),
          tickets: includeSet.has('tickets'),
        };

    const result = unreleased
      ? await relgen.remote.release.describe(
          {
            owner,
            repo,
            unreleased,
          },
          {
            include,
            persona,
            template,
            prompt,
          }
        )
      : await relgen.remote.release.describe(
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
      output(result, (result) => result.description);
    } else {
      output({}, () => kleur.red('No changes found'));
    }
  });

release
  .command('ascribe')
  .argument('<repo>', 'owner or owner/repo')
  .argument('[repo]', 'repo')
  .option('--to <to>', 'tag of a release')
  .option('--from <from>', 'tag of a release')
  .addOption(
    new Option('--unreleased', 'use all unreleased PRs').conflicts([
      'to',
      'from',
    ])
  )
  .option(
    '--excluded-pattern <pattern>',
    'regex pattern to exclude PRs',
    (val) => new RegExp(val)
  )
  .option(
    '--excluded-contexts <excluded-contexts>',
    'which contexts to exclude, for smaller context windows (file-content)',
    (val) => z.array(z.enum(['file-content'])).parse(val.split(','))
  )
  .description(
    'ascribe PRs to authors in a release (if no tags are provided, all PRs are used)'
  )
  .action(async (first, second, options) => {
    const { from, to, unreleased, excludedPattern, excludedContexts } = options;
    const { owner, repo } = parseRepoArgs(first, second);

    const result = unreleased
      ? await relgen.remote.release.ascribe(
          {
            owner,
            repo,
            unreleased,
          },
          {
            excludedPattern,
            excludedContexts,
          }
        )
      : await relgen.remote.release.ascribe(
          {
            owner,
            repo,
            fromTag: from,
            toTag: to,
          },
          {
            excludedPattern,
          }
        );

    if (result) {
      output(result, (result) => {
        const lines: string[] = [];

        for (const { author, items } of result) {
          lines.push(`## ${author}`);
          for (const item of items) {
            lines.push(`- ${item.pr.title}: ${item.pr.url}`);
            lines.push(`  ${item.relgen.complexity}`);
          }
        }

        return lines.join('\n');
      });
    } else {
      output([], () => kleur.red('No changes found'));
    }
  });

const pr = remote.command('pr').description('tasks related to pull requests');

pr.command('describe')
  .argument('<owner>', 'issue URL or owner/repo or owner')
  .argument('[repo]', 'repository or PR number')
  .argument('[number]', 'PR number', (val) => toInt(val, undefined))
  .option(
    '-w, --write <write>',
    'which part of the pr to write to (comma separated list of title,description,comment)',
    (val) =>
      z.array(z.enum(['comment', 'title', 'description'])).parse(val.split(','))
  )
  .option(
    '--excluded-contexts <excluded-contexts>',
    'which contexts to exclude, for smaller context windows (comma separated list of ticket,file-content)',
    (val) => z.array(z.enum(['ticket', 'file-content'])).parse(val.split(','))
  )
  .option('--footer <footer>', 'footer')
  .option('--template <template>', 'template file')
  .option('--prompt <prompt>', 'prompt file')
  .description('describe a pull request')
  .action(async (first, second, third, options) => {
    // TODO: support numbers alone when we have gh cli support
    const { owner, repo, num } = parseIssueArgs(first, second, third);

    const {
      write,
      template: templateFile,
      prompt: promptFile,
      footer,
      excludedContexts,
    } = options;

    let template: string | undefined;
    let prompt: string | undefined;

    if (templateFile) {
      template = (await readFile(templateFile, 'utf-8')).trim();
    }

    if (promptFile) {
      prompt = (await readFile(promptFile, 'utf-8')).trim();
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
        excludedContexts,
      }
    );

    output(result, (result) => {
      return dedent`
        # ${result.title}
        complexity: ${result.complexity}
        description: ${result.description || ''}
      `;
    });
  });

pr.command('label')
  .argument('<owner>', 'issue URL or owner/repo or owner')
  .argument('[repo]', 'repository or PR number')
  .argument('[number]', 'PR number', (val) => toInt(val, undefined))
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
  .action(async (first, second, third, options) => {
    const { owner, repo, num } = parseIssueArgs(first, second, third);

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

    output(result, (result) =>
      result.labels.length
        ? result.labels.join(', ')
        : kleur.red('No labels added')
    );
  });

await cli.parseAsync();
