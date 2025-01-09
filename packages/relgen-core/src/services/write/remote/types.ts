import type { IssueContext, PullRequestContext } from '../../context';
import type { GeneratedIssueLabel, GeneratedPullRequestLabel } from '../../llm';

export type RemoteWriteService = {
  pr: {
    write: (args: {
      context: PullRequestContext;
      generated: GeneratedPullRequestLabel;
      mode: 'add' | 'set';
    }) => Promise<unknown>;
  };
  issue: {
    write: (args: {
      context: IssueContext;
      generated: GeneratedIssueLabel;
      mode: 'add' | 'set';
    }) => Promise<unknown>;
  };
};
