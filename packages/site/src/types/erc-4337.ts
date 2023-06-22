import type { BigNumberish, ethers } from 'ethers';

export type ReputationEntry = {
  address: string;
  opsSeen: number;
  opsIncluded: number;
  status?: ReputationStatus;
};

export enum ReputationStatus {
  OK,
  THROTTLED,
  BANNED,
}

export type EOA = {
  address: string;
  balance: string;
  connected: boolean;
};

export type SmartContractAccount = {
  address: string;
  ownerAddress: string;
  balance: string;
  nonce: string;
  index: string;
  entryPoint: string;
  factoryAddress: string;
  deposit: string;
  connected: boolean;
  userOperationReceipts: UserOperationReceipt[];
  userOpHashesPending: string[];
  bundlerUrls: {[chainId: string]: string };
};

export type UserOperationReceipt = {
  // / the request hash
  userOpHash: string;
  // / the account sending this UserOperation
  sender: string;
  // / account nonce
  nonce: BigNumberish;
  // / the paymaster used for this userOp (or empty)
  paymaster?: string;
  // / actual payment for this UserOperation (by either paymaster or account)
  actualGasCost: BigNumberish;
  // / total gas used by this UserOperation (including preVerification, creation, validation and execution)
  actualGasUsed: BigNumberish;
  // / did this execution completed without revert
  success: boolean;
  // / in case of revert, this is the revert reason
  reason?: string;
  // / the logs generated by this UserOperation (not including logs of other UserOperations in the same bundle)
  logs: any[];

  // the transaction receipt for this transaction (of entire bundle, not only this UserOperation)
  receipt: ethers.providers.TransactionReceipt;
};
