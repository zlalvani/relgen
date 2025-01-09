import type {
  DiffContext,
  IssueContext,
  LabelContext,
  PullRequestContext,
  PullRequestFileContext,
} from '..';

export type RemoteContextService = {
  pr: {
    diff: (args: {
      owner: string;
      repo: string;
      num: number;
      excludedFiles?: Set<string>;
    }) => Promise<DiffContext>;
    get: (args: {
      owner: string;
      repo: string;
      num: number;
    }) => Promise<{
      pr: PullRequestContext;
      labels: LabelContext[];
    }>;
    files: (args: {
      owner: string;
      repo: string;
      num: number;
      excludedFiles?: Set<string>;
      excludedContexts?: Set<'ticket' | 'file-content'>;
    }) => Promise<PullRequestFileContext[]>;
  };
  issue: {
    get: (args: {
      owner: string;
      repo: string;
      num: number;
    }) => Promise<{
      issue: IssueContext;
      labels: LabelContext[];
    }>;
  };
  labels: {
    get: (args: {
      owner: string;
      repo: string;
      exclude?: Set<string>;
    }) => Promise<LabelContext[]>;
  };
};
