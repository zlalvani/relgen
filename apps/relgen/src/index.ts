#!/usr/bin/env node
import { access, readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { type Command, Option, program } from '@commander-js/extra-typings';
import { password, select } from '@inquirer/prompts';
import { type Relgen, createRelgen } from '@relgen/core';
import * as chrono from 'chrono-node/en';
import kleur from 'kleur';
import pino from 'pino';
import { dedent, parallel, toInt } from 'radashi';
import { z } from 'zod';
import { createSubProcessClient } from './clients/subprocess';
import {
  type Config,
  anthropicModelChoices,
  configSchema,
  deepseekModelChoices,
  openaiModelChoices,
  providerChoices,
  providerModels,
} from './config/schema';

let relgen: Relgen;

let resolvedOpts: {
  provider: (typeof providerChoices)[number];
  model:
    | (typeof openaiModelChoices)[number]
    | (typeof anthropicModelChoices)[number]
    | (typeof deepseekModelChoices)[number];
  llmToken: string;
  logger?: pino.Logger;
  json?: boolean;
  silent?: boolean;
  verbose?: boolean;
};

let configFile: Config | undefined;

const output = <T extends object>(obj: T, serialize?: (obj: T) => string) => {
  if (!resolvedOpts.silent) {
    if (resolvedOpts.json) {
      console.log(JSON.stringify(obj));
    } else {
      console.log(serialize ? serialize(obj) : obj);
    }
  }
};

program
  .command('init')
  .description('create a .relgen.json file')
  .action(async () => {
    try {
      await access('.relgen.json');
      output({}, () => kleur.red('.relgen.json already exists'));
    } catch {
      // ignore
    }

    const provider = await select({
      message: 'Select LLM provider',
      choices: providerChoices.map((provider) => ({
        value: provider,
        name: provider,
      })),
    });

    const model = await select({
      message: 'Select LLM model',
      choices: providerModels[provider].map((model) => ({
        value: model,
        name: model,
      })),
    });

    const apiKey = await password({
      message: 'Enter LLM token (leave empty to skip)',
    });

    const githubToken = await password({
      message: 'Enter GitHub token (leave empty to skip)',
    });

    const llm = {
      provider,
      model,
      apiKey: apiKey || undefined,
    } as
      | {
          provider: 'openai';
          model: (typeof openaiModelChoices)[number];
          apiKey?: string;
        }
      | {
          provider: 'anthropic';
          model: (typeof anthropicModelChoices)[number];
          apiKey?: string;
        }
      | {
          provider: 'deepseek';
          model: (typeof deepseekModelChoices)[number];
          apiKey?: string;
        };

    const config: Config = {
      llm,
      integrations: githubToken
        ? {
            github: {
              token: githubToken,
            },
          }
        : undefined,
    };

    await writeFile('.relgen.json', JSON.stringify(config, null, 2));
  });

const applyBaseCommandOpts = (cmd: Command) => {
  return cmd
    .option('-t, --llm-token <token>', 'llm token')
    .option('-s, --silent', 'do not print output')
    .option('-c, --config <config>', 'config file')
    .option('--json', 'output as json')
    .addOption(
      new Option(
        '-v, --verbose',
        'verbose output (debug statements)'
      ).conflicts('silent')
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
        ...deepseekModelChoices,
      ])
    )
    .hook('preAction', async (cmd) => {
      let { llmToken, provider, model, verbose, config, json, silent } =
        cmd.opts();

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
        (provider === 'deepseek' && process.env.DEEPSEEK_API_KEY) ||
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
        json,
        silent,
        verbose,
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
};

const remote = applyBaseCommandOpts(program.command('remote'))
  .option('-g, --github <token>', 'github token')
  .description('tasks relating to the code hosting platform')
  .hook('preAction', async (cmd) => {
    let { github: githubToken } = cmd.opts();

    const { provider, model, llmToken, logger } = resolvedOpts;

    const subprocess = createSubProcessClient();

    githubToken =
      githubToken ||
      process.env.GITHUB_TOKEN ||
      configFile?.integrations?.github?.token ||
      subprocess.exec('gh auth token') ||
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

pr.command('review')
  .argument('<owner>', 'issue URL or owner/repo or owner')
  .argument('[repo]', 'repository or PR number')
  .argument('[number]', 'PR number', (val) => toInt(val, undefined))
  .option('-r, --rule <rule...>', 'rules for the reviewer to follow')
  .option('--rule-file <rule-file...>', 'rules for the reviewer to follow')
  .addOption(
    new Option('--rule-eval <rule-eval>', 'rule evaluation mode').choices([
      'together',
      'separate',
    ] as const)
  )
  .addOption(
    new Option('--file-eval <file-eval>', 'file evaluation mode').choices([
      'together',
      'separate',
    ] as const)
  )
  .option('--footer <footer>', 'footer')
  .option('-w, --write', 'publish the review')
  .option(
    '--excluded-contexts <excluded-contexts>',
    'which contexts to exclude, for smaller context windows (file-content)',
    (val) => z.array(z.enum(['file-content'])).parse(val.split(','))
  )
  .description('review a pull request')
  .action(async (first, second, third, options) => {
    const { owner, repo, num } = parseIssueArgs(first, second, third);

    const { rule, write, excludedContexts, footer } = options;

    const ruleEval =
      options.ruleEval ??
      configFile?.commands?.remote?.pr?.review?.ruleEvalMode;

    const fileEval =
      options.fileEval ??
      configFile?.commands?.remote?.pr?.review?.fileEvalMode;

    const configRules = configFile?.commands?.remote?.pr?.review?.rules
      ? await parallel(
          10,
          configFile.commands.remote.pr.review.rules,
          async (rule) => {
            if (typeof rule === 'string') {
              return rule;
            }

            return (await readFile(rule.file, 'utf-8')).trim();
          }
        )
      : [];

    const ruleFiles = options.ruleFile
      ? await parallel(10, options.ruleFile, async (file) =>
          (await readFile(file, 'utf-8')).trim()
        )
      : [];

    const rules = [...(rule ?? []), ...configRules, ...ruleFiles];

    const result = await relgen.remote.pr.review(
      {
        owner,
        repo,
        num,
        rules,
      },
      {
        write,
        ruleEval,
        fileEval,
        footer,
        excludedContexts,
      }
    );

    output(result, (result) => {
      return dedent`
        # ${result.reviews.length > 0 ? (result.summary ?? 'Reviewed by Relgen') : 'LGTM'}
        ${result.reviews
          .map((review) => {
            return dedent`
            ## ${review.comment}
            line: ${review.line}
            comment: ${review.comment}
          `;
          })
          .join('\n')}
      `;
    });
  });

await program.parseAsync();
