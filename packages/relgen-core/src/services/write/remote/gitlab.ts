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
      review: async ({ context, generated }) => {},
      update: async ({
        context,
        title,
        taggedBody,
      }: {
        context: GitlabPullRequestContext;
        title?: string;
        taggedBody?: string;
      }) => {},
      comment: async ({
        context,
        taggedBody,
        tag,
      }: {
        context: GitlabPullRequestContext;
        taggedBody: string;
        tag: string;
      }) => {},
      label: async ({
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
      label: async ({
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
