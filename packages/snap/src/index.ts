import { OnRpcRequestHandler, OnCronjobHandler } from '@metamask/snaps-types';
import { SimpleAccountAPI } from '@account-abstraction/sdk';
import { UserOperationStruct } from '@account-abstraction/contracts';
import { copyable, heading, panel, text } from '@metamask/snaps-ui';
import { deepHexlify } from '@account-abstraction/utils';
import { resolveProperties } from 'ethers/lib/utils';
import { HttpRpcClient, getBalance, getDeposit } from './client';
import { getSimpleScAccount } from './wallet';
import {
  getUserOpHashsConfirmed,
  getUserOpHashsPending,
  storeUserOpHashConfirmed,
  storeUserOpHashPending,
} from './state';
import { UserOperationReceipt } from './types';

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  const chainId = await ethereum.request({ method: 'eth_chainId' });
  const rpcClient = new HttpRpcClient(parseInt(chainId as string, 16));
  let result;
  let scAccount: SimpleAccountAPI;
  let scOwnerAddress: string;
  let scAddress: string;

  let target: string;
  let data: string;
  let index: string;
  let userOp: UserOperationStruct;
  let hexifiedUserOp: UserOperationStruct;

  let userOpHash: string;
  let userOpHashesConfirmed: string[];
  const userOperationReceipts: UserOperationReceipt[] = [];

  if (!request.params) {
    request.params = [];
  }

  switch (request.method) {
    case 'eth_sendUserOperation':
      target = (request.params as any[])[0];
      data = (request.params as any[])[1];
      index = (request.params as any[])[2];
      scAccount = await getSimpleScAccount(
        rpcClient.getEntryPointAddr(),
        rpcClient.getAccountFactoryAddr(),
        index,
      );

      if (
        await snap.request({
          method: 'snap_dialog',
          params: {
            type: 'confirmation',
            content: panel([
              heading(`(${origin}) - Do you want to send a User operation?`),
              text(`Target: ${target}`),
              text(`ChainId: ${parseInt(chainId as string, 16)}`),
              text(`Entry point contract: ${rpcClient.getEntryPointAddr()}`),
              text(
                `Smart contract account: ${await scAccount.getAccountAddress()}`,
              ),
            ]),
          },
        })
      ) {
        // create user operation and send it
        userOp = await scAccount.createSignedUserOp({ target, data });
        hexifiedUserOp = deepHexlify(await resolveProperties(userOp));
        userOpHash = await rpcClient.send(request.method, [
          hexifiedUserOp,
          rpcClient.getEntryPointAddr(),
        ]);

        if (userOpHash) {
          if (!(await storeUserOpHashPending(userOpHash, index))) {
            throw new Error('Failed to store user operation hash');
          }
          return snap.request({
            method: 'snap_dialog',
            params: {
              type: 'alert',
              content: panel([
                heading('Transaction Sent'),
                text(
                  `Sent from Deposit account: ${await scAccount.getAccountAddress()}`,
                ),
                text(`To: ${target}`),
              ]),
            },
          });
        }
        // TODO: handle error show reason for failing
        throw new Error('Transaction failed');
      }
      throw new Error('User cancelled the Transaction');
    case 'sc_account':
      scAccount = await getSimpleScAccount(
        rpcClient.getEntryPointAddr(),
        rpcClient.getAccountFactoryAddr(),
      );
      scAddress = await scAccount.getCounterFactualAddress();
      scOwnerAddress = await scAccount.owner.getAddress();

      result = JSON.stringify({
        address: scAddress,
        balance: await getBalance(scAddress),
        nonce: await scAccount.getNonce(),
        index: scAccount.index,
        entryPoint: rpcClient.getEntryPointAddr(),
        factoryAddress: rpcClient.getAccountFactoryAddr(),
        deposit: await getDeposit(scAddress, rpcClient.getEntryPointAddr()),
        ownerAddress: scOwnerAddress,
        bundlerUrl: rpcClient.getBundlerUrl(),
      });
      return result;
    case 'get_confirmed_transactions':
      index = (request.params as any[])[0];
      userOpHashesConfirmed = await getUserOpHashsConfirmed(index);
      for (const userOpHash1 of userOpHashesConfirmed) {
        const userOperationReceipt = await rpcClient.send(
          'eth_getUserOperationReceipt',
          [userOpHash1],
        );

        if (userOperationReceipt) {
          userOperationReceipts.push(
            userOperationReceipt as UserOperationReceipt,
          );
        }
      }
      result = JSON.stringify(userOperationReceipts);
      return result;
    case 'eth_chainId':
      return await rpcClient.send(request.method, request.params as any[]);
    case 'eth_getUserOperationReceipt':
      return await rpcClient.send(request.method, request.params as any[]);
    case 'eth_supportedEntryPoints':
      return await rpcClient.send(request.method, request.params as any[]);
    case 'eth_estimateUserOperationGas':
      return await rpcClient.send(request.method, request.params as any[]);
    case 'eth_getUserOperationByHash':
      return await rpcClient.send(request.method, request.params as any[]);
    case 'web3_clientVersion':
      return await rpcClient.send(request.method, request.params as any[]);
    case 'debug_bundler_clearState':
      return await rpcClient.send(request.method, request.params as any[]);
    case 'debug_bundler_dumpMempool':
      return await rpcClient.send(request.method, request.params as any[]);
    case 'debug_bundler_sendBundleNow':
      return await rpcClient.send(request.method, request.params as any[]);
    case 'debug_bundler_setBundlingMode':
      return await rpcClient.send(request.method, request.params as any[]);
    case 'debug_bundler_setReputation':
      return await rpcClient.send(request.method, request.params as any[]);
    case 'debug_bundler_dumpReputation':
      return await rpcClient.send(request.method, request.params as any[]);
    default:
      throw new Error('Method not found.');
  }
};

export const onCronjob: OnCronjobHandler = async ({ request }) => {
  const chainId = await ethereum.request({ method: 'eth_chainId' });

  try {
    const rpcClient = new HttpRpcClient(parseInt(chainId as string, 16));
    let userOpHash: string;
    let userOpHashesPending: string[] = [];
    let userOperationReceipt: UserOperationReceipt;

    switch (request.method) {
      case 'checkUserOperationReceiptReady':
        userOpHashesPending = await getUserOpHashsPending();
        if (userOpHashesPending.length === 0) {
          return null;
        }

        userOpHash = userOpHashesPending[userOpHashesPending.length - 1];
        userOperationReceipt = await rpcClient.send(
          'eth_getUserOperationReceipt',
          [userOpHash],
        );

        if (!userOperationReceipt) {
          return null;
        }
        userOpHash = userOpHashesPending[userOpHashesPending.length - 1];
        await storeUserOpHashConfirmed(userOpHash);

        /* TODO: clean up alert message
          Success: true
          Revert: undefined
          TransactionHash: 0xa8356721bfcdf68b37a30ecf799fd7b487123054c95dec6def8f92dd49412c85
          userOpHash: 0x777078e79787ccab4b6835a68df1d4883ee5475a6172b7aa263ec3260620963d
          Sender: 0x76B446d851d32F032666770c62884a4b158de912
          Nonce: 0x3
          Paymaster: undefined
          Actual Gas Cost: 0x894f593b3614
          Actual Gas Used: 0x15546
        */
        return snap.request({
          method: 'snap_dialog',
          params: {
            type: 'alert',
            content: panel([
              heading('Transaction Confirmed'),
              text(`Success: ${userOperationReceipt.success}`),
              text(`Revert: ${userOperationReceipt.reason}`),
              copyable(
                `TransactionHash: ${userOperationReceipt.receipt.transactionHash}`,
              ),
              text(`userOpHash: ${userOperationReceipt.userOpHash}`),
              text(`Sender: ${userOperationReceipt.sender}`),
              text(`Nonce: ${userOperationReceipt.nonce}`),
              text(`Paymaster: ${userOperationReceipt.paymaster}`),
              text(`Actual Gas Cost: ${userOperationReceipt.actualGasCost}`),
              text(`Actual Gas Used: ${userOperationReceipt.actualGasUsed}`),
            ]),
          },
        });
      default:
        throw new Error('Method not found.');
    }
  } catch (error) {
    if (
      error.message ===
      `ChainId ${parseInt(chainId as string, 16)} not supported`
    ) {
      return null;
    }
    throw error;
  }
};
