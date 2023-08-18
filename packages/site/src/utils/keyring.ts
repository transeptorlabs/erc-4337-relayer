import {
  KeyringAccount,
  KeyringRequest,
  KeyringSnapRpcClient,
} from '@metamask/keyring-api';
import { defaultSnapOrigin } from '../config';
import { getMMProvider } from './metamask';

export type KeyringState = {
  pendingRequests: KeyringRequest[];
  accounts: KeyringAccount[];
};

export const getKeyringClient = (): KeyringSnapRpcClient => {
  return new KeyringSnapRpcClient(defaultSnapOrigin, getMMProvider());
};
