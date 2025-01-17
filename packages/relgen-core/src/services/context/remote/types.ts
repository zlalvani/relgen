import type {
  DiffContext,
  IssueContext,
  LabelContext,
  PullRequestContext,
  PullRequestFileContext,
} from '..';

export type RemoteContextService = {
  pr: {
    unreleased: (args: {
      owner: string;
      repo: string;
      include: {
        issues: boolean;
      };
    }) => Promise<
      {
        pr: PullRequestContext;
        labels: LabelContext[];
        issue?: IssueContext;
      }[]
    >;
    betweenTags: (args: {
      owner: string;
      repo: string;
      include: {
        issues: boolean;
      };
      fromTag?: string;
      toTag?: string;
    }) => Promise<
      {
        pr: PullRequestContext;
        labels: LabelContext[];
        issue?: IssueContext;
      }[]
    >;
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
      excludedContexts?: {
        fileContent?: boolean;
      };
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
