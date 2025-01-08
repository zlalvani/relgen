import dedent from 'dedent';
import type { GithubClient } from '../../../clients/github';
import { makeContext } from '../../context';
import type { RemoteContextService } from './types';

export const githubContextService = (github: GithubClient) => {
  return {
    pr: {
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

        return makeContext({
          type: 'pr',
          data: pr,
          prompt: dedent`
          <pr>
            <title>${pr.data.title}</title>
            <body>${pr.data.body}</body>
          </pr>
        `,
        });
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
            data: issue,
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
