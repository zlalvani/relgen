import type { GithubClient } from '../../../clients/github';
import type { GitlabClient } from '../../../clients/gitlab';
import { githubWriteService } from './github';
import { gitlabWriteService } from './gitlab';

export const createRemoteWriteService = (
  clients:
    | {
        github: GithubClient;
        gitlab?: never;
      }
    | {
        github?: never;
        gitlab: GitlabClient;
      }
) => {
  if (clients.github) {
    return githubWriteService(clients.github);
  }

  if (clients.gitlab) {
    return gitlabWriteService(clients.gitlab);
  }
  throw new Error('Unsupported remote write service');
};
