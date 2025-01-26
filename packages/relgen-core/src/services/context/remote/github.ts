import type { File } from 'gitdiff-parser';
import type pino from 'pino';
import { dedent, parallel } from 'radashi';
import type { SharedUnionFields } from 'type-fest';
import type { GithubClient } from '../../../clients/github';
import { type PullRequestFileContext, makeContext } from '../../context';
import type { RemoteContextService } from './types';

// ChatGPT generated - serialize a list of files to a GitHub diff
function serializeToGitHubDiff(files: File[]): string {
  return files
    .map((file) => {
      const oldPath = file.oldPath;
      const newPath = file.newPath;
      const oldMode = file.oldMode;
      const newMode = file.newMode;
      const oldRevision = file.oldRevision;
      const newRevision = file.newRevision;

      const lines: string[] = [];
      lines.push(`diff --git a/${oldPath} b/${newPath}`);

      // If file is renamed or copied, show similarity index, rename/copy from/to lines
      if (file.type === 'rename' || file.type === 'copy') {
        const similarity = file.similarity || 100;
        lines.push(`similarity index ${similarity}%`);
        if (file.type === 'rename') {
          lines.push(`rename from ${oldPath}`);
          lines.push(`rename to ${newPath}`);
        } else if (file.type === 'copy') {
          lines.push(`copy from ${oldPath}`);
          lines.push(`copy to ${newPath}`);
        }
      }

      // If mode changed
      if (oldMode && newMode && oldMode !== newMode) {
        lines.push(`old mode ${oldMode}`);
        lines.push(`new mode ${newMode}`);
      }

      // Show index line
      // Example: index 2c33c4f..f50b8db 100644
      lines.push(
        `index ${oldRevision.substring(0, 7)}..${newRevision.substring(0, 7)} ${newMode}`
      );

      // Show old/new path lines, omit if file is added or deleted
      if (file.type !== 'add' && file.type !== 'copy') {
        lines.push(`--- a/${oldPath}`);
      } else {
        // Representing no old file with `/dev/null`
        lines.push('--- /dev/null');
      }

      if (file.type !== 'delete' && file.type !== 'copy') {
        lines.push(`+++ b/${newPath}`);
      } else {
        // Representing no new file with `/dev/null`
        lines.push('+++ /dev/null');
      }

      // Hunks
      for (const hunk of file.hunks) {
        const hunkHeader = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
        lines.push(hunkHeader + (hunk.content ? ` ${hunk.content}` : ''));

        for (const change of hunk.changes) {
          if (change.type === 'normal') {
            lines.push(` ${change.content}`);
          } else if (change.type === 'insert') {
            lines.push(`+${change.content}`);
          } else if (change.type === 'delete') {
            lines.push(`-${change.content}`);
          }
        }
      }

      return lines.join('\n');
    })
    .join('\n');
}

function isText(content: string) {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    decoder.decode(Buffer.from(content, 'base64'));
    return true;
  } catch {
    return false;
  }
}

export const githubContextService = (
  github: GithubClient,
  logger: pino.Logger
) => {
  const getUnreleasedPrs = async ({
    owner,
    repo,
  }: {
    owner: string;
    repo: string;
  }) => {
    const githubRepo = await github.$rest.repos.get({
      owner,
      repo,
    });

    const defaultBranch = githubRepo.data.default_branch;

    const latest = await github.rest.repos.getLatestRelease({
      owner,
      repo,
    });

    return (
      await github.rest.search.issuesAndPullRequests({
        repo: {
          owner,
          repo,
        },
        type: 'pr',
        base: defaultBranch,
        status: 'merged',
        mergedAfter: latest?.data.published_at
          ? new Date(latest.data.published_at)
          : undefined,
      })
    ).data.items;
  };

  const getPrsBetweenTags = async ({
    owner,
    repo,
    fromTag,
    toTag,
  }: {
    owner: string;
    repo: string;
    fromTag?: string;
    toTag?: string;
  }) => {
    const githubRepo = await github.$rest.repos.get({
      owner,
      repo,
    });

    const defaultBranch = githubRepo.data.default_branch;

    const from = fromTag
      ? await github.$rest.repos.getReleaseByTag({
          owner,
          repo,
          tag: fromTag,
        })
      : undefined;

    const to = toTag
      ? await github.$rest.repos.getReleaseByTag({
          owner,
          repo,
          tag: toTag,
        })
      : undefined;

    return (
      await github.rest.search.issuesAndPullRequests({
        repo: {
          owner,
          repo,
        },
        type: 'pr',
        base: defaultBranch,
        status: 'merged',
        mergedAfter: from?.data.published_at
          ? new Date(from.data.published_at)
          : undefined,
        mergedBefore: to?.data.published_at
          ? new Date(to.data.published_at)
          : undefined,
      })
    ).data.items;
  };

  const getTimerangePrs = async ({
    owner,
    repo,
    from,
    to,
  }: {
    owner: string;
    repo: string;
    from?: Date;
    to?: Date;
  }) => {
    const githubRepo = await github.$rest.repos.get({
      owner,
      repo,
    });

    const defaultBranch = githubRepo.data.default_branch;

    return (
      await github.rest.search.issuesAndPullRequests({
        repo: {
          owner,
          repo,
        },
        type: 'pr',
        base: defaultBranch,
        status: 'merged',
        mergedAfter: from,
        mergedBefore: to,
      })
    ).data.items;
  };

  const makePrContext = (args: {
    pr: SharedUnionFields<
      | Awaited<
          ReturnType<
            | typeof getUnreleasedPrs
            | typeof getPrsBetweenTags
            | typeof getTimerangePrs
          >
        >[number]
      | Awaited<ReturnType<(typeof github)['$rest']['pulls']['get']>>['data']
    >;
    owner: string;
    repo: string;
    num: number;
    issue?: Awaited<
      ReturnType<
        (typeof github)['graphql']['repo']['pull']['batchClosingIssuesReferences']
      >
    >[number]['issues'][number];
  }) => {
    const { pr, owner, repo, num, issue } = args;

    // TODO: include labels for the issues and comments for both
    return {
      pr: makeContext({
        type: 'pr',
        data: {
          pr,
          owner,
          repo,
          num,
        },
        prompt: dedent`
          <pr>
            <title>${pr.title}</title>
            <body>
            ${pr.body}
            </body>
          </pr>
        `,
      }),
      labels: pr.labels.map((label) => {
        return makeContext({
          type: 'label',
          data: label,
          prompt: dedent`
            <label>
            ${
              typeof label === 'string'
                ? `<name>${label}</name>`
                : `<name>${label.name}</name>`
            }
            </label>
          `,
        });
      }),
      issue: issue
        ? makeContext({
            type: 'issue',
            data: {
              issue,
              owner,
              repo,
              num,
            },
            prompt: dedent`
              <issue>
                <title>${issue.title}</title>
                <body>${issue.body}</body>
              </issue>
            `,
          })
        : undefined,
    };
  };

  const batchMakePrContext = (args: {
    prs: Awaited<
      ReturnType<
        | typeof getUnreleasedPrs
        | typeof getPrsBetweenTags
        | typeof getTimerangePrs
      >
    >;
    issues: Awaited<
      ReturnType<
        (typeof github)['graphql']['repo']['pull']['batchClosingIssuesReferences']
      >
    >;
    owner: string;
    repo: string;
    include: {
      issues: boolean;
    };
  }) => {
    const { prs, owner, repo, issues, include } = args;

    const issueMap = issues.reduce((acc, curr) => {
      acc.set(curr.num, curr.issues);
      return acc;
    }, new Map<number, (typeof issues)[number]['issues']>());

    return prs.map((pr) => {
      // Only take the first linked issue for now
      const issue = issueMap.get(pr.number)?.[0];

      return makePrContext({
        pr,
        owner,
        repo,
        num: pr.number,
        issue: include.issues ? issue : undefined,
      });
    });
  };

  return {
    pr: {
      unreleased: async ({
        owner,
        repo,
        include,
      }: {
        owner: string;
        repo: string;
        include: {
          issues: boolean;
        };
      }) => {
        const prs = await getUnreleasedPrs({
          owner,
          repo,
        });

        if (!prs.length) {
          return [];
        }

        const issues = include.issues
          ? await github.graphql.repo.pull.batchClosingIssuesReferences({
              owner,
              repo,
              nums: prs.map((pr) => pr.number),
            })
          : [];

        return batchMakePrContext({
          prs,
          issues,
          owner,
          repo,
          include,
        });
      },
      betweenTags: async ({
        owner,
        repo,
        include,
        fromTag,
        toTag,
      }: {
        owner: string;
        repo: string;
        include: {
          issues: boolean;
        };
        fromTag?: string;
        toTag?: string;
      }) => {
        const prs = await getPrsBetweenTags({
          owner,
          repo,
          fromTag,
          toTag,
        });

        if (!prs.length) {
          return [];
        }

        const issues = include.issues
          ? await github.graphql.repo.pull.batchClosingIssuesReferences({
              owner,
              repo,
              nums: prs.map((pr) => pr.number),
            })
          : [];

        return batchMakePrContext({
          prs,
          issues,
          owner,
          repo,
          include,
        });
      },
      diff: async ({
        owner,
        repo,
        num,
        excludedFiles,
      }: {
        owner: string;
        repo: string;
        num: number;
        excludedFiles?: Set<string>;
      }) => {
        const diff = await github.rest.pulls.diff({
          owner,
          repo,
          num,
        });

        return makeContext({
          type: 'diff',
          data: {
            diff,
            owner,
            repo,
            num,
          },
          prompt: dedent`
            <diff>
              ${serializeToGitHubDiff(
                diff.data.files
                  .filter((file) => !file.isBinary)
                  .map((file) => {
                    return {
                      ...file,
                      oldName: file.oldPath.split('/').pop(),
                      newName: file.newPath.split('/').pop(),
                    };
                  })
                  .filter(
                    (file) =>
                      file.oldName &&
                      file.newName &&
                      (!excludedFiles ||
                        (!excludedFiles.has(file.oldName) &&
                          !excludedFiles.has(file.newName)))
                  )
              )}
            </diff>
            `,
        });
      },
      get: async ({
        owner,
        repo,
        num,
      }: {
        owner: string;
        repo: string;
        num: number;
      }) => {
        const pr = await github.$rest.pulls.get({
          owner,
          repo,
          pull_number: num,
        });
        return makePrContext({
          pr: pr.data,
          owner,
          repo,
          num,
        });
      },
      files: async ({
        owner,
        repo,
        num,
        excludedFiles,
        excludedContexts,
      }: {
        owner: string;
        repo: string;
        num: number;
        excludedFiles?: Set<string>;
        excludedContexts?: {
          fileContent?: boolean;
        };
      }): Promise<
        (PullRequestFileContext & {
          data: {
            fileData: Awaited<
              ReturnType<(typeof github)['$rest']['pulls']['listFiles']>
            >['data'][number];
          };
        })[]
      > => {
        const files = await github.$rest.pulls.listFiles({
          owner,
          repo,
          pull_number: num,
          per_page: 100,
        });

        if (excludedContexts?.fileContent) {
          return files.data
            .filter(
              (file) => !excludedFiles || !excludedFiles.has(file.filename)
            )
            .map((file) => {
              return makeContext({
                type: 'pr-file',
                data: {
                  fileData: file,
                  patch: file.patch ?? null,
                  path: file.filename,
                  content: null,
                },
                prompt: dedent`
                <file path="${file.filename}" status="${file.status}" additions="${file.additions}" deletions="${file.deletions}">
                  <patch>
                  ${file.patch}
                  </patch>
                </file>
                `,
              });
            });
        }

        const pull = await github.$rest.pulls.get({
          owner,
          repo,
          pull_number: num,
        });

        return await parallel(
          3,
          files.data
            .filter(
              (file) => !excludedFiles || !excludedFiles.has(file.filename)
            )
            .filter((file) => file.filename),
          async (file) => {
            if (file.status === 'removed') {
              return makeContext({
                type: 'pr-file',
                data: {
                  fileData: file,
                  patch: file.patch ?? null,
                  content: null,
                  path: file.filename,
                },
                prompt: dedent`
                <file path="${file.filename}" status="${file.status}" additions="${file.additions}" deletions="${file.deletions}">
                  <patch>
                  ${file.patch}
                  </patch>
                </file>
                `,
              });
            }

            const retrieved = await github.$rest.repos.getContent({
              owner,
              repo,
              path: file.filename,
              ref: pull.data.head.ref,
            });

            if (
              Array.isArray(retrieved.data) ||
              retrieved.data.type !== 'file' ||
              retrieved.data.encoding !== 'base64' ||
              !isText(retrieved.data.content)
            ) {
              logger.debug({
                message: 'Skipping file content',
                retrieved: retrieved.data,
              });

              return makeContext({
                type: 'pr-file',
                data: {
                  fileData: file,
                  patch: null,
                  content: null,
                  path: file.filename,
                },
                prompt: dedent`
                <file path="${file.filename}" status="${file.status}" additions="${file.additions}" deletions="${file.deletions}">
                </file>
                `,
              });
            }

            return makeContext({
              type: 'pr-file',
              data: {
                fileData: file,
                patch: file.patch ?? null,
                path: file.filename,
                content: Buffer.from(retrieved.data.content, 'base64').toString(
                  'utf-8'
                ),
              },
              prompt: dedent`
            <file path="${file.filename}" status="${file.status}" additions="${file.additions}" deletions="${file.deletions}">
              <content>
              ${Buffer.from(retrieved.data.content, 'base64').toString('utf-8')}
              </content>
              <patch>
              ${file.patch}
              </patch>
            </file>
            `,
            });
          }
        );
      },
    },
    issue: {
      get: async ({
        owner,
        repo,
        num,
      }: {
        owner: string;
        repo: string;
        num: number;
      }) => {
        const issue = await github.$rest.issues.get({
          owner,
          repo,
          issue_number: num,
        });

        return {
          issue: makeContext({
            type: 'issue',
            data: {
              issue,
              owner,
              repo,
              num,
            },
            prompt: dedent`
            <issue>
              <title>${issue.data.title}</title>
              <body>${issue.data.body}</body>
            </issue>
            `,
          }),
          labels: issue.data.labels.map((label) => {
            return makeContext({
              type: 'label',
              data: label,
              prompt: dedent`
                <label>
                ${
                  typeof label === 'string'
                    ? `<name>${label}</name>`
                    : `<name>${label.name}</name>`
                }
                </label>
              `,
            });
          }),
        };
      },
    },
    labels: {
      get: async ({
        owner,
        repo,
        exclude,
      }: {
        owner: string;
        repo: string;
        exclude?: Set<string>;
      }) => {
        const labels = await github.$rest.issues.listLabelsForRepo({
          owner,
          repo,
        });

        return labels.data
          .filter((label) => !exclude || !exclude.has(label.name))
          .map((label) => {
            return makeContext({
              type: 'label',
              data: label,
              prompt: dedent`
              <label>
                <name>${label.name}</name>
                <description>${label.description}</description>
              </label>
            `,
            });
          });
      },
    },
  } satisfies RemoteContextService;
};

export type GithubContextService = ReturnType<typeof githubContextService>;
export type GithubIssueContext = Awaited<
  ReturnType<GithubContextService['issue']['get']>
>['issue'];
export type GithubPullRequestContext = Awaited<
  ReturnType<GithubContextService['pr']['get']>
>['pr'];
export type GithubDiffContext = Awaited<
  ReturnType<GithubContextService['pr']['diff']>
>;
export type GithubPullRequestFileContext = Awaited<
  ReturnType<GithubContextService['pr']['files']>
>[number];
