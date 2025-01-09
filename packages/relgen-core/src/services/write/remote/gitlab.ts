import type { GitlabClient } from '../../../clients/gitlab';
import type {
  GitlabIssueContext,
  GitlabPullRequestContext,
} from '../../context/remote/gitlab';
import type { GeneratedIssueLabel, GeneratedPullRequestLabel } from '../../llm';
import type { RemoteWriteService } from './types';

export const gitlabWriteService = (gitlab: GitlabClient) => {
  return {
    pr: {
      write: async ({
        context,
        generated,
        mode,
      }: {
        context: GitlabPullRequestContext;
        generated: GeneratedPullRequestLabel;
        mode: 'add' | 'set';
      }) => {},
    },
    issue: {
      write: async ({
        context,
        generated,
        mode,
      }: {
        context: GitlabIssueContext;
        generated: GeneratedIssueLabel;
        mode: 'add' | 'set';
      }) => {},
    },
  } satisfies RemoteWriteService;
};

export type GitlabWriteService = ReturnType<typeof gitlabWriteService>;
