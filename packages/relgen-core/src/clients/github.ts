import diffparser from 'gitdiff-parser';
import { Octokit, RequestError } from 'octokit';
import { dedent, toInt, tryit } from 'radashi';
import { z } from 'zod';

const IssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  body: z.string(),
});

const BatchClosingIssuesReferencesSchema = z.object({
  repository: z.record(
    z
      .string()
      .regex(/pr(\d+)/)
      .transform((key) => key as `pr${number}`),
    z.object({
      closingIssuesReferences: z.object({
        nodes: z.array(IssueSchema),
      }),
    })
  ),
});

const PullRequestCommentSchema = z.object({
  author: z.object({
    login: z.string(),
  }),
  body: z.string().optional(),
});

const BatchPullRequestCommentsSchema = z.object({
  repository: z.record(
    z
      .string()
      .regex(/pr(\d+)/)
      .transform((key) => key as `pr${number}`),
    z.object({
      comments: z.object({
        nodes: z.array(PullRequestCommentSchema),
      }),
    })
  ),
});

const success = <T>(
  arg: [Error | undefined, T | undefined]
): arg is [undefined, T] => !arg[0];

export const githubClient = (octo: Octokit) => {
  return {
    $rest: octo.rest as Octokit['rest'],
    http: {
      getRawContent: async (url: string) => {
        const result = await fetch(url, { redirect: 'follow' });

        if (!result.ok) {
          throw new Error(`Failed to fetch ${url}`);
        }

        return await result.text();
      },
    },
    rest: {
      users: {
        getAuthenticated: async () => {
          const result = await tryit(() =>
            octo.rest.users.getAuthenticated()
          )();

          if (!success(result)) {
            const [error] = result;
            if (error instanceof RequestError && error.status === 403) {
              return null;
            }
            throw error;
          }

          const [_, response] = result;
          return response;
        },
      },
      search: {
        issuesAndPullRequests: async (query: {
          repo?: {
            owner: string;
            repo: string;
          };
          type?: 'issue' | 'pr';
          status?: 'open' | 'closed' | 'merged';
          base?: string;
          mergedAfter?: Date;
          mergedBefore?: Date;
        }) => {
          const filters: string[] = [];

          if (query.repo) {
            filters.push(`repo:${query.repo.owner}/${query.repo.repo}`);
          }

          if (query.type) {
            filters.push(`is:${query.type}`);
          }

          if (query.status) {
            filters.push(`is:${query.status}`);
          }

          if (query.mergedAfter) {
            filters.push(`merged:>${query.mergedAfter.toISOString()}`);
          }

          if (query.mergedBefore) {
            filters.push(`merged:<${query.mergedBefore.toISOString()}`);
          }

          if (query.base) {
            filters.push(`base:${query.base}`);
          }

          const q = filters.join(' ');

          const result = await tryit(() =>
            octo.rest.search.issuesAndPullRequests({
              q,
            })
          )();

          if (!success(result)) {
            const [error] = result;
            throw error;
          }

          const [_, response] = result;
          return response;
        },
      },
      repos: {
        getLatestRelease: async ({
          owner,
          repo,
        }: {
          owner: string;
          repo: string;
        }) => {
          const result = await tryit(() =>
            octo.request('GET /repos/{owner}/{repo}/releases/latest', {
              owner,
              repo,
            })
          )();

          if (!success(result)) {
            const [error] = result;

            if (error instanceof RequestError && error.status === 404) {
              return null;
            }
            throw error;
          }

          const [_, response] = result;
          return response;
        },
      },
      pulls: {
        diff: async ({
          owner,
          repo,
          num,
        }: {
          owner: string;
          repo: string;
          num: number;
        }) => {
          // Use a no-arg callback because tryit mangles the types otherwise
          const result = await tryit(() =>
            octo.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
              owner,
              repo,
              pull_number: num,
              headers: {
                Accept: 'application/vnd.github.v3.diff',
              },
            })
          )();

          if (!success(result)) {
            const [error] = result;
            throw error;
          }

          const [_, response] = result;

          return {
            ...response,
            data: {
              files: diffparser.parse(response.data as unknown as string),
              $raw: response.data as unknown as string,
            }, // Octokit has the wrong type here
          };
        },
      },
    },
    graphql: {
      repo: {
        pull: {
          batchClosingIssuesReferences: async ({
            owner,
            repo,
            nums,
          }: {
            owner: string;
            repo: string;
            nums: number[];
          }) => {
            // cursed, tbh
            const query = dedent`
              query ($owner: String!, $repo: String!) {
                repository(owner: $owner, name: $repo) {
                  ${nums
                    .map(
                      (num) => `
                    pr${num}: pullRequest(number: ${num}) {
                      closingIssuesReferences(first: 50) {
                        nodes {
                          number
                          title
                          url
                          body
                        }
                      }
                    }`
                    )
                    .join('\n')}
                }
              }
            `;

            const response = await octo.graphql(query, {
              owner,
              repo,
              nums,
            });

            return Object.entries(
              BatchClosingIssuesReferencesSchema.parse(response).repository
            )
              .filter(
                <L, R>(pair: [L, R | undefined]): pair is [L, R] => !!pair[1]
              )
              .map(([key, value]) => ({
                num: toInt(key.slice(2)),
                issues: value.closingIssuesReferences.nodes,
              }));
          },
          batchPullRequestComments: async ({
            owner,
            repo,
            nums,
          }: {
            owner: string;
            repo: string;
            nums: number[];
          }) => {
            const query = dedent`
              query ($owner: String!, $repo: String!) {
                repository(owner: $owner, name: $repo) {
                  ${nums
                    .map(
                      (num) => `
                    pr${num}: pullRequest(number: ${num}) {
                      comments(first: 50) {
                        nodes {
                          author {
                            login
                          }
                          body
                        }
                      }
                    }`
                    )
                    .join('\n')}
                }
              }
            `;

            const response = await octo.graphql(query, {
              owner,
              repo,
              nums,
            });

            return Object.entries(
              BatchPullRequestCommentsSchema.parse(response).repository
            )
              .filter(
                <L, R>(pair: [L, R | undefined]): pair is [L, R] => !!pair[1]
              )
              .map(([key, value]) => ({
                num: toInt(key.slice(2)),
                comments: value.comments.nodes,
              }));
          },
        },
      },
    },
  };
};

export const createGithubClient = ({
  token,
}: {
  token: string;
}) => {
  return githubClient(new Octokit({ auth: token }));
};

export type GithubClient = ReturnType<typeof githubClient>;
