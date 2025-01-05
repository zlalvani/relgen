export type ContextType =
  | 'ticket'
  | 'pr'
  | 'issue'
  | 'diff'
  | 'code'
  | 'label'
  | 'pr-file';
export type ContextSource = 'github' | 'linear' | 'jira';

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
export type PullRequestFileContext = Context<'github', 'pr-file', unknown>;
export type DiffContext = Context<'github', 'diff', unknown>;
export type IssueContext = Context<'github', 'issue', unknown>;
export type TicketContext = Context<'linear', 'ticket', unknown>;
export type CodeContext = Context<'github', 'code', unknown>;
export type LabelContext = Context<'github', 'label', unknown>;

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
