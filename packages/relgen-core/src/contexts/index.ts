export type ContextType = 'ticket' | 'pr' | 'issue' | 'diff' | 'code';
export type ContextSource = 'github' | 'linear' | 'jira';

// export type Context<
//   TType extends ContextType,
//   TData extends {},
//   TDependencies extends {},
// > = {
//   name: TType;
//   // data: TData;
//   accessible: (
//     dependencies: Partial<TDependencies>
//   ) => dependencies is TDependencies;
//   fetch: (dependencies: TDependencies) => Promise<TData>;
//   prompt: (data: TData) => string;
// };

// export type Context<TType extends ContextType, TData extends {}> = {
//   name: TType;
//   fetch: () => Promise<TData>;
//   prompt: (data: TData) => () => string;
// };

// export const context = <TType extends ContextType, TData extends {}>(
//   name: TType,
//   fetch: Context<TType, TData>['fetch'],
//   prompt: Context<TType, TData>['prompt']
// ): Context<TType, TData> => {
//   return {
//     name,
//     fetch,
//     prompt,
//   };
// };

export type Context<
  TSource extends ContextSource,
  TType extends ContextType,
  TData,
> = {
  source: TSource;
  type: TType;
  data: TData;
  prompt: string;
};

export type PullRequestContext = Context<'github', 'pr', unknown>;
export type DiffContext = Context<'github', 'diff', unknown>;
export type IssueContext = Context<'github', 'issue', unknown>;
export type TicketContext = Context<'linear', 'ticket', unknown>;

// Helper for initializing a context
export const makeContext = <
  TSource extends ContextSource,
  TType extends ContextType,
  TData,
>({
  source,
  type,
  data,
  prompt,
}: {
  source: TSource;
  type: TType;
  data: TData;
  prompt: string;
}): Context<TSource, TType, TData> => {
  return {
    source,
    type,
    data,
    prompt,
  };
};

// export type ContextFactory<
//   TSource extends ContextSource,
//   TType extends ContextType,
//   TArgs extends Record<string, unknown>,
//   TData extends Record<string, unknown>,
//   TDependencies extends Record<string, unknown>,
// > = {
//   source: TSource;
//   build: (props: { args: TArgs; deps: TDependencies }) => Promise<
//     Context<TType, TData>
//   >;
// };

// export const makeContextFactory = <
//   TSource extends ContextSource,
//   TType extends ContextType,
//   TArgs extends Record<string, unknown>,
//   TData extends Record<string, unknown>,
//   TDependencies extends Record<string, unknown>,
// >(
//   source: TSource,
//   build: (props: { args: TArgs; deps: TDependencies }) => Promise<
//     Context<TType, TData>
//   >
// ): ContextFactory<TSource, TType, TArgs, TData, TDependencies> => {
//   return {
//     source,
//     build,
//   };
// };

// const githubContext = makeContextFactory('github', async () => {
//   return makeContext('pr', {}, 'Pull Request');
// });

// export const githubContextFactories = {
//   pullRequest: makeContextFactory(
//     'github',
//     async (props: {
//       args: {
//         owner: string;
//         repo: string;
//         num: number;
//       };
//       deps: {
//         github: GithubClient;
//       };
//     }) => {
//       const pr = await props.deps.github.custom.pulls.diff({
//         owner: props.args.owner,
//         repo: props.args.repo,
//         num: props.args.num,
//       });
//       return makeContext('pr', pr, 'Pull Request');
//     }
//   ),
//   // issue: makeContextFactory(
//   //   'github',
//   //   async (props: {
//   //     args: {
//   //       owner: string;
//   //       repo: string;
//   //       num: number;
//   //     };
//   //     deps: {
//   //       github: GithubClient;
//   //     };
//   //   }) => {
//   //     const issue = await props.deps.github.rest.issues.get({
//   //       owner: props.args.owner,
//   //       repo: props.args.repo,
//   //       issue_number: props.args.num,
//   //     });
//   //     return makeContext('issue', issue, 'Issue');
//   //   }
//   // ),
// };

// githubContextFactories.pullRequest.build();

// export const contextBuilder = <
//   TType extends ContextType,
//   TData extends {},
//   TDependencies extends {}>() => {

//   }

// export type ContextSource<
//   TType extends string,
//   TData extends {},
//   TDependencies extends {},
// > = {

// };

// export type ContextDestination<
//   TType extends string,
//   TData extends {},
//   TDependencies extends {},
// > = {
//   prompt: (data: TData) => string;
// };

// export const context = <
//   TType extends string,
//   TData extends {},
//   TDependencies extends {},
// >(
//   name: TType,
//   accessible: Context<TType, TData, TDependencies>['accessible'],
//   fetch: Context<TType, TData, TDependencies>['fetch'],
//   prompt: Context<TType, TData, TDependencies>['prompt']
// ): Context<TType, TData, TDependencies> => {
//   return {
//     name,
//     accessible,
//     fetch,
//     prompt,
//   };
// };

// // export const context2 = <TType extends string, TData extends {}>({
// //   name,
// //   fetch,
// //   prompt,
// // }: Context<TType, TData>) => {
// //   return {
// //     name,
// //     fetch,
// //     prompt,
// //   };
// // };

// const fooContext = context(
//   'foo',
//   (dependencies) => {
//     return 'github' in dependencies;
//     // return true;
//   },
//   async ({
//     github,
//   }: {
//     github: GithubClient;
//   }) => {
//     return { foo: 'bar' };
//   },
//   (dependencies, data) => {
//     return data.foo;
//   }
// );

// // const barContext = context2({
// //   name: 'bar',
// //   fetch: async () => {
// //     return { bar: 'baz' };
// //   },
// //   prompt: (data) => {
// //     return data.baz;
// //   },
// // });
