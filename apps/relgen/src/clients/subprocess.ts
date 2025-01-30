import { execSync } from 'node:child_process';

export const subProcessClient = (proc: typeof process) => {
  return {
    exec: (command: string) => {
      try {
        return execSync(command, { encoding: 'utf-8', env: proc.env }).trim();
      } catch {
        return null;
      }
    },
  };
};

export const createSubProcessClient = () => {
  return subProcessClient(process);
};

export type SubProcessClient = ReturnType<typeof subProcessClient>;
