import { type Evalite, evalite } from 'evalite';
import pino from 'pino';
import { createGithubClient } from '../clients/github';
import {
  type GithubContextService,
  githubContextService,
} from '../services/context/remote/github';
import {
  type LanguageModelService,
  createLanguageModelService,
} from '../services/llm';
import { config } from './config';

const providers = [
  {
    name: 'openai',
    models: ['gpt-4o-mini', 'o3-mini'],
  },
  {
    name: 'anthropic',
    models: ['claude-3-5-sonnet-latest'],
  },
  {
    name: 'deepseek',
    models: ['deepseek-chat'],
  },
] as const;

type Dependencies = {
  llm: LanguageModelService;
  context: GithubContextService;
};

export const parameterizedEval = async <TInput, TExpected = TInput>(
  makeName: (args: {
    provider: (typeof providers)[number]['name'];
    model: string;
  }) => string,
  makeData: (args: { deps: Omit<Dependencies, 'llm'> }) => ReturnType<
    Evalite.RunnerOpts<TInput, TExpected>['data']
  >,
  makeEvaliteOpts: (args: {
    provider: (typeof providers)[number]['name'];
    model: string;
    deps: Dependencies;
  }) => Omit<Evalite.RunnerOpts<TInput, TExpected>, 'data'>
) => {
  const logger = pino({ level: config.logger.level });
  // TODO: replace octokit with a stubbed version that uses fixtures
  const gh = createGithubClient({ token: config.github.token });
  const context = githubContextService(gh, logger);

  const dataResult = await makeData({
    deps: {
      context,
    },
  });

  for (const provider of providers.filter(
    (provider) => config[provider.name].apiKey
  )) {
    for (const model of provider.models) {
      const llm = createLanguageModelService(
        {
          provider: provider.name,
          model,
          apiKey: config[provider.name].apiKey,
        },
        logger
      );

      evalite<TInput, TExpected>(makeName({ provider: provider.name, model }), {
        ...makeEvaliteOpts({
          provider: provider.name,
          model,
          deps: { context, llm },
        }),
        data: () => dataResult,
      });
    }
  }
};
