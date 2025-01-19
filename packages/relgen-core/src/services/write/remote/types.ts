import type {
  IssueContext,
  PullRequestContext,
  PullRequestFileContext,
} from '../../context';
import type {
  GeneratedIssueLabel,
  GeneratedPullRequestLabel,
  GeneratedPullRequestReview,
} from '../../llm';

export type RemoteWriteService = {
  pr: {
    update: (args: {
      context: PullRequestContext;
      taggedBody?: string;
      title?: string;
    }) => Promise<unknown>;
    comment: (args: {
      context: PullRequestContext;
      taggedBody: string;
      tag: string;
    }) => Promise<unknown>;
    label: (args: {
      context: PullRequestContext;
      generated: GeneratedPullRequestLabel;
      mode: 'add' | 'set';
    }) => Promise<unknown>;
    review: (args: {
      context: {
        pr: PullRequestContext;
        files: PullRequestFileContext[];
      };
      generated: GeneratedPullRequestReview;
    }) => Promise<unknown>;
  };
  issue: {
    label: (args: {
      context: IssueContext;
      generated: GeneratedIssueLabel;
      mode: 'add' | 'set';
    }) => Promise<unknown>;
  };
};
