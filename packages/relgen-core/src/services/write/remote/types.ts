import type { IssueContext } from '../../context';
import type { GeneratedIssueLabel } from '../../llm';

export type RemoteWriteService = {
  issue: {
    write: (args: {
      owner: string;
      repo: string;
      num: number;
      context: IssueContext;
      generated: GeneratedIssueLabel;
      mode: 'add' | 'set';
    }) => Promise<unknown>;
  };
};
