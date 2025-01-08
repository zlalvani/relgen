import type { GitlabClient } from '../../../clients/gitlab';
import type { GitlabIssueContext } from '../../context/remote/gitlab';
import type { GeneratedIssueLabel } from '../../llm';
import type { RemoteWriteService } from './types';

export const gitlabWriteService = (gitlab: GitlabClient) => {
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
        context: GitlabIssueContext;
        generated: GeneratedIssueLabel;
        mode: 'add' | 'set';
      }) => {},
    },
  } satisfies RemoteWriteService;
};

export type GitlabWriteService = ReturnType<typeof gitlabWriteService>;
