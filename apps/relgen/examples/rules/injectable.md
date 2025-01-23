If a new module is introduced that has dependencies on other modules (internal or external) with side effects, it should follow a dependency injection pattern.

Example:

```typescript
import { Gitlab } from '@gitbeaker/rest';

export const gitlabClient = (gitlab: InstanceType<typeof Gitlab>) => {
  return {};
};

export const createGitlabClient = (token: string) => {
  return gitlabClient(
    new Gitlab({
      token,
    })
  );
};

export type GitlabClient = ReturnType<typeof gitlabClient>;
```