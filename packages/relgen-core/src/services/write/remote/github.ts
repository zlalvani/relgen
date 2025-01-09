import { unique } from 'radashi';
import type { GithubClient } from '../../../clients/github';
import type {
  GithubIssueContext,
  GithubPullRequestContext,
} from '../../context/remote/github';
import type { GeneratedIssueLabel, GeneratedPullRequestLabel } from '../../llm';
import type { RemoteWriteService } from './types';

export const githubWriteService = (github: GithubClient) => {
  return {
    pr: {
      write: async ({
        context,
        generated,
        mode,
      }: {
        context: GithubPullRequestContext;
        generated: GeneratedPullRequestLabel;
        mode: 'add' | 'set';
      }) => {
        return await github.$rest.issues.update({
          owner: context.data.owner,
          repo: context.data.repo,
          issue_number: context.data.num,
          labels:
            mode === 'set'
              ? generated.object.labels
              : unique([
                  ...context.data.pr.data.labels,
                  ...generated.object.labels,
                ]),
        });
      },
    },
    issue: {
      write: async ({
        context,
        generated,
        mode,
      }: {
        context: GithubIssueContext;
        generated: GeneratedIssueLabel;
        mode: 'add' | 'set';
      }) => {
        return await github.$rest.issues.update({
          owner: context.data.owner,
          repo: context.data.repo,
          issue_number: context.data.num,
          labels:
            mode === 'set'
              ? generated.object.labels
              : unique([
                  ...context.data.issue.data.labels,
                  ...generated.object.labels,
                ]),
        });
      },
    },
  } satisfies RemoteWriteService;
};

export type GithubWriteService = ReturnType<typeof githubWriteService>;
