import { makeContext } from '..';
import type { GitlabClient } from '../../../clients/gitlab';
import type { RemoteContextService } from './types';

export const gitlabContextService = (gitlab: GitlabClient) => {
  return {
    pr: {
      diff: async ({
        owner,
        repo,
        num,
      }: {
        owner: string;
        repo: string;
        num: number;
      }) => {
        return makeContext({
          type: 'diff',
          data: {},
          prompt: '',
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
        return {
          pr: makeContext({
            type: 'pr',
            data: {},
            prompt: '',
          }),
          labels: [],
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
        return {
          issue: makeContext({
            type: 'issue',
            data: {},
            prompt: '',
          }),
          labels: [],
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
        return [];
      },
    },
  } satisfies RemoteContextService;
};

export type GitlabContextService = ReturnType<typeof gitlabContextService>;
export type GitlabIssueContext = Awaited<
  ReturnType<GitlabContextService['issue']['get']>
>['issue'];
export type GitlabPullRequestContext = Awaited<
  ReturnType<GitlabContextService['pr']['get']>
>['pr'];
