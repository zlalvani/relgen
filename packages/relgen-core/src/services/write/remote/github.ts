import type pino from 'pino';
import { unique } from 'radashi';
import type { GithubClient } from '../../../clients/github';
import type {
  GithubIssueContext,
  GithubPullRequestContext,
} from '../../context/remote/github';
import type { GeneratedIssueLabel, GeneratedPullRequestLabel } from '../../llm';
import type { RemoteWriteService } from './types';

export const githubWriteService = (
  github: GithubClient,
  logger: pino.Logger
) => {
  return {
    pr: {
      update: async ({
        context,
        title,
        taggedBody,
      }: {
        context: GithubPullRequestContext;
        title?: string;
        taggedBody?: string;
      }) => {
        return await github.$rest.pulls.update({
          owner: context.data.owner,
          repo: context.data.repo,
          pull_number: context.data.num,
          title,
          body: taggedBody,
        });
      },
      comment: async ({
        context,
        taggedBody,
        tag,
      }: {
        context: GithubPullRequestContext;
        taggedBody: string;
        tag: string;
      }) => {
        const comments = await github.$rest.issues.listComments({
          owner: context.data.owner,
          repo: context.data.repo,
          issue_number: context.data.num,
        });

        const username = (await github.rest.users.getAuthenticated())?.data
          .login;

        logger.debug({
          username,
        });

        const existingComment = comments.data.find(
          (comment) =>
            comment.body?.includes(tag) &&
            (!username || comment.user?.login === username)
        );

        if (existingComment) {
          await github.$rest.issues.updateComment({
            owner: context.data.owner,
            repo: context.data.repo,
            comment_id: existingComment.id,
            body: taggedBody,
          });
        } else {
          await github.$rest.issues.createComment({
            owner: context.data.owner,
            repo: context.data.repo,
            issue_number: context.data.num,
            body: taggedBody,
          });
        }
      },
      label: async ({
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
      label: async ({
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
