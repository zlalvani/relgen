import { Octokit } from 'octokit';

export const githubClient = (octo: Octokit) => {
  return {};
};

export const injectGithubClient = ({
  token,
}: {
  token: string;
}) => {
  return githubClient(new Octokit({ auth: token }));
};

export type GithubClient = ReturnType<typeof githubClient>;
