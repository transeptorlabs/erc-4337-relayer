import { BigNumber } from 'ethers';
import { UserOperationStruct } from '@account-abstraction/contracts';
import { defaultSnapOrigin } from '../config';
import {
  GetSnapsResponse,
  Snap,
  ReputationEntry,
  SmartContractAccount,
  BundlerUrls,
  SmartAccountActivity,
  UserOperation,
  UserOperationReceipt,
  DepositTxs,
} from '../types';
import { getMMProvider } from './metamask';

// Snap management *****************************************************************
/**
 * Get the installed snaps in MetaMask.
 *
 * @returns The snaps installed in MetaMask.
 */
export const getSnaps = async (): Promise<GetSnapsResponse> => {
  return (await getMMProvider().request({
    method: 'wallet_getSnaps',
  })) as unknown as GetSnapsResponse;
};

/**
 * Connect a snap to MetaMask.
 *
 * @param snapId - The ID of the snap.
 * @param params - The params to pass with the snap to connect.
 */
export const connectSnap = async (
  snapId: string = defaultSnapOrigin,
  params: Record<'version' | string, unknown> = {},
) => {
  await getMMProvider().request({
    method: 'wallet_requestSnaps',
    params: {
      [snapId]: params,
    },
  });
};

/**
 * Get the ERC4337 relayer snap from MetaMask.
 *
 * @param version - The version of the snap to install (optional).
 * @returns The snap object returned by the extension.
 */
export const getSnap = async (version?: string): Promise<Snap | undefined> => {
  try {
    const snaps = await getSnaps();

    return Object.values(snaps).find(
      (snap) =>
        snap.id === defaultSnapOrigin && (!version || snap.version === version),
    );
  } catch (e) {
    console.log('Failed to obtain installed snap', e);
    return undefined;
  }
};

export const isLocalSnap = (snapId: string) => snapId.startsWith('local:');

// ERC-4337 account management *****************************************************
export const getScAccount = async (
  keyringAccountId: string,
): Promise<SmartContractAccount> => {
  const result = await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'sc_account', params: [{ keyringAccountId }] },
    },
  });

  const parsedResult = JSON.parse(result as string);
  return {
    initCode: parsedResult.initCode,
    address: parsedResult.address,
    balance: BigNumber.from(parsedResult.balance).toString(),
    entryPoint: parsedResult.entryPoint,
    factoryAddress: parsedResult.factoryAddress,
    nonce: BigNumber.from(parsedResult.nonce),
    index: BigNumber.from(parsedResult.index),
    deposit: BigNumber.from(parsedResult.deposit).toString(),
    connected: true,
    ownerAddress: parsedResult.ownerAddress,
  } as SmartContractAccount;
};

export const getUserOpCallData = async (
  keyringAccountId: string,
  to: string,
  value: BigNumber,
  data: string,
): Promise<string> => {
  return (await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'get_user_op_call_data',
        params: [
          {
            keyringAccountId,
            to,
            value,
            data,
          },
        ],
      },
    },
  })) as string;
};

export const estimatCreationGas = async (
  keyringAccountId: string,
): Promise<BigNumber> => {
  const result = await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'estimate_creation_gas',
        params: [
          {
            keyringAccountId,
          },
        ],
      },
    },
  });
  const parsedResult = JSON.parse(result as string);
  return BigNumber.from(parsedResult) as BigNumber;
};

export const getDepositReadyTx = async (): Promise<DepositTxs> => {
  const result = (await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'deposit_ready_tx', params: [] },
    },
  })) as string;
  const parsedResult = JSON.parse(result as string);
  console.log('getDepositReadyTx:', parsedResult);
  return parsedResult as DepositTxs;
};

export const storeDepositTxHash = async (
  txHash: string,
  requestId: string,
): Promise<boolean> => {
  return (await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'store_deposit_tx_hash', params: [txHash, requestId] },
    },
  })) as boolean;
};

export const getConfirmedUserOperation = async (
  keyringAccountId: string,
): Promise<string[]> => {
  return (await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'confirmed_UserOperation',
        params: [
          {
            keyringAccountId,
          },
        ],
      },
    },
  })) as string[];
};

export const getPendingUserOperation = async (
  keyringAccountId: string,
): Promise<string[]> => {
  return (await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'pending_UserOperation',
        params: [
          {
            keyringAccountId,
          },
        ],
      },
    },
  })) as string[];
};

export const getConfirmedDepositTxHashes = async (): Promise<string[]> => {
  return (await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'confirmed_deposit_tx_hashes',
        params: [],
      },
    },
  })) as string[];
};

export const getUserOperationReceipt = async (
  userOpHash: string,
): Promise<UserOperationReceipt> => {
  const result = (await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'eth_getUserOperationReceipt',
        params: [{ userOpHash }],
      },
    },
  })) as string;
  const parsedResult = JSON.parse(result as string);
  return parsedResult as UserOperationReceipt;
};

export const getSmartAccountActivity = async (
  keyringAccountId: string,
): Promise<SmartAccountActivity> => {
  const [confirmedUserOpHashes, pendingUserOpHashes] = await Promise.all([
    getConfirmedUserOperation(keyringAccountId),
    getPendingUserOperation(keyringAccountId),
  ]);

  const userOperationReceipts: UserOperationReceipt[] = [];
  confirmedUserOpHashes.forEach(async (confirmedUserOpHash) => {
    const receipt = await getUserOperationReceipt(confirmedUserOpHash);
    if (receipt !== undefined || receipt !== null) {
      userOperationReceipts.push(receipt);
    }
  });

  return {
    pendingUserOpHashes,
    confirmedUserOpHashes,
    userOperationReceipts,
    confirmedDepositTxHashes: await getConfirmedDepositTxHashes(),
  } as SmartAccountActivity;
};

export const clearActivityData = async (): Promise<boolean> => {
  return (await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'clear_activity_data', params: [] },
    },
  })) as boolean;
};

export const addBundlerUrl = async (
  chainId: string,
  url: string,
): Promise<boolean> => {
  return (await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'add_bundler_url', params: [chainId, url] },
    },
  })) as boolean;
};

export const bundlerUrls = async (): Promise<BundlerUrls> => {
  const result = (await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'get_bundler_urls', params: [] },
    },
  })) as string;
  const parsedResult = JSON.parse(result as string);
  return parsedResult as BundlerUrls;
};

// ERC-4337 wrappers ******************************************************
export const sendSupportedEntryPoints = async (): Promise<string[]> => {
  return (await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'eth_supportedEntryPoints', params: [] },
    },
  })) as string[];
};

export const estimateUserOperationGas = async (
  userOp: UserOperationStruct,
): Promise<{
  preVerificationGas: BigNumber;
  verificationGas: BigNumber;
  validAfter: BigNumber;
  validUntil: BigNumber;
  callGasLimit: BigNumber;
}> => {
  const result = await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'eth_estimateUserOperationGas', params: [{ userOp }] },
    },
  });

  const parsedResult = JSON.parse(result as string);
  return {
    preVerificationGas: BigNumber.from(parsedResult.preVerificationGas),
    verificationGas: BigNumber.from(parsedResult.verificationGas),
    validAfter: BigNumber.from(parsedResult.validAfter),
    validUntil: BigNumber.from(parsedResult.validUntil),
    callGasLimit: BigNumber.from(parsedResult.callGasLimit),
  };
};

export const getUserOperationByHash = async (
  userOpHash: string,
): Promise<UserOperation> => {
  const result = await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'eth_getUserOperationByHash',
        params: [
          {
            userOpHash,
          },
        ],
      },
    },
  });

  const parsedResult = JSON.parse(result as string);
  return parsedResult as UserOperation;
};

export const sendClientVersion = async () => {
  return await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'web3_clientVersion' },
    },
  });
};

export const sendDebugBundlerClearState = async () => {
  return await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'debug_bundler_clearState' },
    },
  });
};

export const sendDebugBundlerDumpMempool = async () => {
  return await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'debug_bundler_dumpMempool' },
    },
  });
};

export const sendDebugBundlerSendBundleNow = async () => {
  return await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'debug_bundler_sendBundleNow' },
    },
  });
};

export const sendDebugBundlerSetBundlingMode = async (
  mode: 'auto' | 'manual',
) => {
  return await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'debug_bundler_setBundlingMode', params: [mode] },
    },
  });
};

export const sendDebugBundlerSetReputation = async (
  reputations: ReputationEntry[],
  supportedEntryPoints: string,
) => {
  return await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: {
        method: 'debug_bundler_setReputation',
        params: [reputations, supportedEntryPoints],
      },
    },
  });
};

export const sendDebugBundlerDumpReputation = async () => {
  return await getMMProvider().request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'debug_bundler_dumpReputation' },
    },
  });
};
