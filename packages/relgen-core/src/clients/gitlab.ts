import { Gitlab } from '@gitbeaker/rest';

export const gitlabClient = (gitlab: InstanceType<typeof Gitlab>) => {
  return {};
};

export const createGitlabClient = () => {
  return gitlabClient(
    new Gitlab({
      token: '',
    })
  );
};

export type GitlabClient = ReturnType<typeof gitlabClient>;
