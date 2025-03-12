export type ContextType =
  | 'ticket'
  | 'pr'
  | 'pr-file'
  | 'pr-review-comment'
  | 'issue'
  | 'diff'
  | 'code'
  | 'label';

export type Context<TType extends ContextType, TData> = {
  type: TType;
  data: TData;
  prompt: string;
};

// TODO: clean up these suppressions when biome 2.0 is released

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type PullRequestContext<TData = any> = Context<'pr', TData>;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type PullRequestFileContext<TData = any> = Context<
  'pr-file',
  {
    path: string;
    patch: string | null;
    content: string | null;
    fileData: TData;
  }
>;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type DiffContext<TData = any> = Context<'diff', TData>;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type IssueContext<TData = any> = Context<'issue', TData>;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type TicketContext<TData = any> = Context<'ticket', TData>;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type CodeContext<TData = any> = Context<'code', TData>;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type LabelContext<TData = any> = Context<'label', TData>;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type PullRequestReviewCommentContext<TData = any> = Context<
  'pr-review-comment',
  TData
>;

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
