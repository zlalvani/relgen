import Fuse from 'fuse.js';
import type pino from 'pino';
import { unique } from 'radashi';
import type { GithubClient } from '../../../clients/github';
import type {
  GithubIssueContext,
  GithubPullRequestContext,
  GithubPullRequestFileContext,
} from '../../context/remote/github';
import type {
  GeneratedIssueLabel,
  GeneratedPullRequestLabel,
  GeneratedPullRequestReview,
} from '../../llm';
import type { RemoteWriteService } from './types';

const REVIEW_TAG = '<!-- Reviewed by Relgen -->';

export const githubWriteService = (
  github: GithubClient,
  logger: pino.Logger
) => {
  return {
    pr: {
      review: async ({
        context,
        generated,
        footer,
      }: {
        context: {
          pr: GithubPullRequestContext;
          files: GithubPullRequestFileContext[];
        };
        generated: GeneratedPullRequestReview;
        footer?: string;
      }) => {
        logger.debug({
          object: generated,
        });

        const comments = generated.reviews
          .map((review) => {
            const diffHunk = context.files.at(review.fileContextId);

            if (!diffHunk) {
              logger.warn({
                message: 'Could not find file for review',
                review,
              });
              return null;
            }

            diffHunk.data.patch;

            if (!diffHunk.data.patch) {
              logger.warn({
                message: 'Could not find patch for review',
                review,
              });
              return null;
            }

            const diffLines = diffHunk.data.patch.split('\n');

            const hunkStartLine = diffLines.findIndex((line) =>
              line.trim().startsWith('@@')
            );

            const adjustedLines = diffLines
              .slice(hunkStartLine)
              .map((line) => line.trim());

            const fuse = new Fuse(adjustedLines, {
              keys: ['line'],
              threshold: 0.05,
            });

            const findLineIndex = (
              fuse: Fuse<string>,
              reviewSearch: GeneratedPullRequestReview['reviews'][number]
            ) => {
              const matches = fuse.search(reviewSearch.line.trim());

              if (!matches[0]) {
                logger.warn({
                  message: 'Could not find line',
                  review,
                  matches,
                });
                return null;
              }

              const sortedMatches = matches.sort(
                (a, b) => a.refIndex - b.refIndex
              );

              const selectedLine = sortedMatches[reviewSearch.occurrence];

              if (!selectedLine) {
                logger.warn({
                  message: 'Could not find line',
                  review,
                  matches,
                });
                return null;
              }

              return selectedLine.refIndex;
            };

            const startLine = findLineIndex(fuse, review);

            if (!startLine) {
              return null;
            }

            return {
              path: diffHunk.data.path,
              position: startLine,
              body: review.comment,
            };
          })
          .filter(<T>(x: T | null): x is T => x !== null);

        logger.debug({
          comments,
        });

        const body = [
          generated.reviews.length > 0
            ? (generated.summary ?? 'Some notes')
            : 'LGTM',
          footer,
          REVIEW_TAG,
        ]
          .filter((content) => content)
          .join('\n\n');

        return await github.$rest.pulls.createReview({
          owner: context.pr.data.owner,
          repo: context.pr.data.repo,
          pull_number: context.pr.data.num,
          event: 'COMMENT',
          body,
          comments,
        });
      },
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
              : unique([...context.data.pr.labels, ...generated.object.labels]),
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
