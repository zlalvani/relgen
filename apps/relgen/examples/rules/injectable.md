If a new module is introduced that has dependencies on other modules (internal or external) with side effects, it should follow a dependency injection pattern by scoping dependencies inside of a closure. 

Example:

```typescript
import { Octokit, RequestError } from 'octokit';

export const githubClient = (octo: Octokit) => {
  return {
    $rest: octo.rest as Octokit['rest'],
    rest: {
      users: {
        getAuthenticated: async () => {
          const result = await tryit(() =>
            octo.rest.users.getAuthenticated()
          )();

          if (!success(result)) {
            const [error] = result;
            if (error instanceof RequestError && error.status === 403) {
              return null;
            }
            throw error;
          }

          const [_, response] = result;
          return response;
        },
      },
    },
  };
};

export const createGithubClient = ({
  token,
}: {
  token: string;
}) => {
  return githubClient(new Octokit({ auth: token }));
};
```

Usage: 

```typescript
const github = createGithubClient({ token: 'my-token' });
```