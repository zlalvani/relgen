import { type Evalite, evalite } from 'evalite';
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

export const parameterizedEval = async <TInput, TExpected = TInput>(
  makeName: (
    provider: (typeof providers)[number]['name'],
    model: string
  ) => string,
  data: Evalite.RunnerOpts<TInput, TExpected>['data'],
  makeOptions: (
    provider: (typeof providers)[number]['name'],
    model: string
  ) => Omit<Evalite.RunnerOpts<TInput, TExpected>, 'data'>
) => {
  const dataResult = await data();
  for (const provider of providers.filter(
    (provider) => config[provider.name].apiKey
  )) {
    for (const model of provider.models) {
      evalite<TInput, TExpected>(makeName(provider.name, model), {
        ...makeOptions(provider.name, model),
        data: () => dataResult,
      });
    }
  }
};
