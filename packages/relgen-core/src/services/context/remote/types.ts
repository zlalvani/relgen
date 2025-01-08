import type { IssueContext, LabelContext, PullRequestContext } from '..';

export type RemoteContextService = {
  pr: {
    get: (args: {
      owner: string;
      repo: string;
      num: number;
    }) => Promise<PullRequestContext>;
    file: {
      get: () => void;
    };
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
