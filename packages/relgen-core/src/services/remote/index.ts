import type { GithubClient } from '../../clients/github';
import type { GitlabClient } from '../../clients/gitlab';
import { githubContextService } from '../context/remote/github';
import { gitlabContextService } from '../context/remote/gitlab';
import type { RemoteContextService } from '../context/remote/types';
import { githubWriteService } from '../write/remote/github';
import { gitlabWriteService } from '../write/remote/gitlab';
import type { RemoteWriteService } from '../write/remote/types';

export const remoteService = (
  context: RemoteContextService,
  write: RemoteWriteService
) => {
  return {
    context,
    write,
  };
};

export const createRemoteService = (
  clients:
    | {
        github?: never;
        gitlab: GitlabClient;
      }
    | {
        github: GithubClient;
        gitlab?: never;
      }
) => {
  if (clients.github) {
    return remoteService(
      githubContextService(clients.github),
      githubWriteService(clients.github)
    );
  }
  return remoteService(
    gitlabContextService(clients.gitlab),
    gitlabWriteService(clients.gitlab)
  );
};

export type RemoteService = ReturnType<typeof createRemoteService>;
