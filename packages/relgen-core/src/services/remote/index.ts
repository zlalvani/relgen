import type { GithubClient } from '../../clients/github';
import type { GitlabClient } from '../../clients/gitlab';
import { githubContextService } from '../context/remote/github';
import { gitlabContextService } from '../context/remote/gitlab';
import type { RemoteContextService } from '../context/remote/types';
import { githubWriteService } from '../write/remote/github';
import { gitlabWriteService } from '../write/remote/gitlab';
import type { RemoteWriteService } from '../write/remote/types';

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
): {
  context: RemoteContextService;
  write: RemoteWriteService;
} => {
  if (clients.github) {
    return {
      context: githubContextService(clients.github),
      write: githubWriteService(clients.github),
    };
  }
  return {
    context: gitlabContextService(clients.gitlab),
    write: gitlabWriteService(clients.gitlab),
  };
};

export type RemoteService = ReturnType<typeof createRemoteService>;
