export type ContextType =
  | 'ticket'
  | 'pr'
  | 'issue'
  | 'diff'
  | 'code'
  | 'label'
  | 'pr-file';

export type Context<TType extends ContextType, TData> = {
  type: TType;
  data: TData;
  prompt: string;
};

export type PullRequestContext<TData = unknown> = Context<'pr', TData>;
export type PullRequestFileContext<TData = unknown> = Context<'pr-file', TData>;
export type DiffContext<TData = unknown> = Context<'diff', TData>;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type IssueContext<TData = any> = Context<'issue', TData>;
export type TicketContext<TData = unknown> = Context<'ticket', TData>;
export type CodeContext<TData = unknown> = Context<'code', TData>;
export type LabelContext<TData = unknown> = Context<'label', TData>;

// Helper for initializing a context
export const makeContext = <TType extends ContextType, TData>({
  type,
  data,
  prompt,
}: {
  type: TType;
  data: TData;
  prompt: string;
}): Context<TType, TData> => {
  return {
    type,
    data,
    prompt,
  };
};
