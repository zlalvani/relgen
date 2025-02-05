import { type Evalite, evalite } from 'evalite';

type RunnerOptsFactory<TInput, TExpected> = (
  provider: (typeof providers)[number]['name'],
  model: string
) => Evalite.RunnerOpts<TInput, TExpected>;

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

export const parameterizedEval = <TInput, TExpected = TInput>(
  makeName: (
    provider: (typeof providers)[number]['name'],
    model: string
  ) => string,
  data: Evalite.RunnerOpts<TInput, TExpected>['data'],
  makeOptions: (
    provider: (typeof providers)[number]['name'],
    model: string
  ) => Evalite.RunnerOpts<TInput, TExpected>
) => {
  for (const provider of providers) {
    for (const model of provider.models) {
      evalite<TInput, TExpected>(
        makeName(provider.name, model),
        makeOptions(provider.name, model)
      );
    }
  }
};

// export function parameterizedEval<R extends Evalite.RunnerOpts<unknown, unknown>>(
//   makeName: (
//     provider: (typeof providers)[number]['name'],
//     model: string
//   ) => string,
//   // Notice that makeOptions is now a generic callback that returns R.
//   makeOptions: (
//     provider: (typeof providers)[number]['name'],
//     model: string
//   ) => R
// ) {
//   // Here we extract the types from R.
//   type TInput = R extends Evalite.RunnerOpts<infer I, unknown> ? I : never;
//   type TExpected = R extends Evalite.RunnerOpts<unknown, infer E> ? E : never;

//   for (const provider of providers) {
//     for (const model of provider.models) {
//       evalite<TInput, TExpected>(
//         makeName(provider.name, model),
//         makeOptions(provider.name, model)
//       );
//     }
//   }
// }
