import type { GithubClient } from '../../../clients/github';
import type { GitlabClient } from '../../../clients/gitlab';
import { githubContextService } from './github';

export const createRemoteContextService = (
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
    return githubContextService(clients.github);
  }
  throw new Error('Unsupported remote context service');
};

// export type RemoteContextService = ReturnType<
//   typeof createRemoteContextService
// >;
