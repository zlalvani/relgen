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

export const githubWriteService = (
  github: GithubClient,
  logger: pino.Logger
) => {
  return {
    pr: {
      review: async ({
        context,
        generated,
      }: {
        context: {
          pr: GithubPullRequestContext;
          files: GithubPullRequestFileContext[];
        };
        generated: GeneratedPullRequestReview;
      }) => {
        // const diff = await github.rest.pulls.diff({
        //   owner: context.pr.data.owner,
        //   repo: context.pr.data.repo,
        //   num: context.pr.data.num,
        // });

        // logger.debug({
        //   message: diff.data.$raw,
        // });
        logger.debug({
          object: generated.object,
        });

        const comments = generated.object.reviews
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
              threshold: 0.1,
            });

            const findLineIndex = (
              fuse: Fuse<string>,
              reviewSearch: GeneratedPullRequestReview['object']['reviews'][number]['start']
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

              if (matches.length > 1) {
                const prevMatch = fuse.search(
                  reviewSearch.previousLine.trim()
                )[0];
                const nextMatch = fuse.search(reviewSearch.nextLine.trim())[0];

                const prevMatches = new Set(
                  fuse
                    .search(reviewSearch.previousLine.trim())
                    .map((r) => r.refIndex)
                );
                const nextMatches = new Set(
                  fuse
                    .search(reviewSearch.nextLine.trim())
                    .map((r) => r.refIndex)
                );

                if (!prevMatch || !nextMatch) {
                  logger.warn({
                    message: 'Ambiguous line',
                    review,
                    matches,
                  });
                  return null;
                }

                return adjustedLines.findIndex(
                  (_, index) =>
                    prevMatches.has(index - 1) && nextMatches.has(index + 1)
                  // index > prevMatch.refIndex && index < nextMatch.refIndex
                );
              }

              return matches[0].refIndex;
            };

            const startLine = findLineIndex(fuse, review.start);

            if (!startLine) {
              return null;
            }

            return {
              path: diffHunk.data.path,
              position: startLine,
              // start_line: startLine,
              body: review.comment,
            };

            // if (!review.end) {
            //   return {
            //     path: diffHunk.data.path,
            //     position: startLine,
            //     // start_line: startLine,
            //     body: review.comment,
            //   };
            // }

            // const endLine = findLineIndex(fuse, review.end);

            // if (!endLine) {
            //   return null;
            // }

            // return {
            //   path: diffHunk.data.path,
            //   start_line: startLine,
            //   line: endLine,
            //   // position: startLine,
            //   body: review.comment,
            // };
          })
          .filter(<T>(x: T | null): x is T => x !== null);

        logger.debug({
          comments,
        });

        return await github.$rest.pulls.createReview({
          owner: context.pr.data.owner,
          repo: context.pr.data.repo,
          pull_number: context.pr.data.num,
          event: 'COMMENT',
          // body: 'Relgen comment',
          body:
            comments.length > 0
              ? (generated.object.comment ?? 'Reviewed by Relgen')
              : 'LGTM',
          comments,
          // body: generated.object.body,
          // event: generated.object.event,
          // comments: generated.object.comments,
          // comments_url: context.files[0].data.comments_url,
          // commit_id: context.files[0].data.commit_id,
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
