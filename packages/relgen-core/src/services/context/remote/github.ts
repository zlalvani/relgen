import type { File } from 'gitdiff-parser';
import { dedent } from 'radashi';
import type { GithubClient } from '../../../clients/github';
import { makeContext } from '../../context';
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

export const githubContextService = (github: GithubClient) => {
  return {
    pr: {
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
            <title>${pr.data.title}</title>
            <body>
            ${pr.data.body}
            </body>
          </pr>
        `,
          }),
          labels: pr.data.labels.map((label) => {
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
      file: {
        get: async () => {},
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
