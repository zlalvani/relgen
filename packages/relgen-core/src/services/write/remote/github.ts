import { unique } from 'radashi';
import type { GithubClient } from '../../../clients/github';
import type { GithubIssueContext } from '../../context/remote/github';
import type { GeneratedIssueLabel } from '../../llm';
import type { RemoteWriteService } from './types';

export const githubWriteService = (github: GithubClient) => {
  return {
    issue: {
      write: async ({
        owner,
        repo,
        num,
        context,
        generated,
        mode,
      }: {
        owner: string;
        repo: string;
        num: number;
        context: GithubIssueContext;
        generated: GeneratedIssueLabel;
        mode: 'add' | 'set';
      }) => {
        return await github.$rest.issues.update({
          owner,
          repo,
          issue_number: num,
          labels:
            mode === 'set'
              ? generated.object.labels
              : unique([
                  ...context.data.data.labels,
                  ...generated.object.labels,
                ]),
        });
      },
    },
  } satisfies RemoteWriteService;
};

export type GithubWriteService = ReturnType<typeof githubWriteService>;
