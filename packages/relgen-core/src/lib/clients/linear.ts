import { LinearClient as SdkClient } from '@linear/sdk';

export const linearClient = (sdk: SdkClient) => {
  return {};
};

export const injectLinearClient = ({
  token,
}: {
  token: string;
}) => {
  return linearClient(new SdkClient({ apiKey: token }));
};

export type LinearClient = ReturnType<typeof linearClient>;
