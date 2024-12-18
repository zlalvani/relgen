import diffparser from 'gitdiff-parser';
import { Octokit } from 'octokit';

export const githubClient = (octo: Octokit) => {
  return {
    rest: octo.rest as Octokit['rest'],
    custom: {
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
          const response = await octo.request(
            'GET /repos/{owner}/{repo}/pulls/{pull_number}',
            {
              owner,
              repo,
              pull_number: num,
              headers: {
                Accept: 'application/vnd.github.v3.diff',
              },
            }
          );

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
    graphql: {},
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
