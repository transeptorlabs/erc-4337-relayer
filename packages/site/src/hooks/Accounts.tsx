import { useContext } from 'react';
import { MetamaskActions, MetaMaskContext } from '.';
import { AccountActivity, AccountActivityType, BundlerUrls, SmartContractAccount } from "../types";
import { bundlerUrls, fetchUserOpHashes, getAccountBalance, getChainId, getKeyringSnapRpcClient, getMMProvider, getNextRequestId, getScAccount, getTxHashes, getUserOperationReceipt, parseChainId, sendSupportedEntryPoints } from "../utils";
import { KeyringAccount } from "@metamask/keyring-api";
import { KeyringSnapRpcClient } from '@metamask/keyring-api';

export const useAcount = () => {
  const [state, dispatch] = useContext(MetaMaskContext);
  const snapRpcClient: KeyringSnapRpcClient = getKeyringSnapRpcClient();

  const getKeyringSnapAccounts = async (): Promise<KeyringAccount[]> => {
    const accounts = await snapRpcClient.listAccounts();
    const pendingRequests = await snapRpcClient.listRequests();
    dispatch({ 
      type: MetamaskActions.SetSnapKeyring,
      payload: {
        accounts,
        pendingRequests,
      } 
    });
    return accounts;
  }

  const selectKeyringSnapAccount = async (selectedKeyringAccount: KeyringAccount): Promise<KeyringAccount> => {
    dispatch({
      type: MetamaskActions.SetSelectedSnapKeyringAccount,
      payload: selectedKeyringAccount,
    });
    return selectedKeyringAccount;
  };

  const updateAccountBalance = async (account: string): Promise<string> => {
    const balance = await getAccountBalance(account)
    dispatch({
      type: MetamaskActions.SetSelectedAccountBalance,
      payload: balance,
    });
    return balance;
  };

  const createAccount = async (accountName: string) => {
    const newAccount = await snapRpcClient.createAccount(accountName);
    await getKeyringSnapAccounts()
    return newAccount
  };

  const deleteAccount = async (keyringAccountId: string) => {
    await snapRpcClient.deleteAccount(keyringAccountId);
    await getKeyringSnapAccounts()
  };

  const sendRequest = async (keyringAccountId: string, method: string, params: any[] = []) => {
    const id = await getNextRequestId()
    await snapRpcClient.submitRequest({
      account: keyringAccountId,
      scope: `eip155:${parseChainId(state.chainId)}`,
      request: {
        id: id.toString(),
        jsonrpc: '2.0',
        method,
        params: params,
      }
    });
    await getKeyringSnapAccounts()
  };

  const approveRequest = async (requestId: string) => {
    await snapRpcClient.approveRequest(requestId);
    await getKeyringSnapAccounts()
  };

  const rejectRequest = async (requestId: string) => {
    await snapRpcClient.rejectRequest(requestId);
    await getKeyringSnapAccounts()
  };

  const rejectAllPendingRequests = async () => {
    const pendingRequests = await snapRpcClient.listRequests();
    for (const rq of pendingRequests) {
      await snapRpcClient.rejectRequest(rq.request.id);
    }
    await getKeyringSnapAccounts()
  }

  const getSmartAccount = async (keyringAccountId: string): Promise<SmartContractAccount> => {
    const [scAccount, supportedEntryPoints] = await Promise.all([
      getScAccount(keyringAccountId),
      sendSupportedEntryPoints(),
    ]);

    dispatch({
      type: MetamaskActions.SetScAccount,
      payload: scAccount,
    });

    dispatch({
      type: MetamaskActions.SetSupportedEntryPoints,
      payload: supportedEntryPoints,
    });
    return scAccount;
  };

  const getAccountActivity = async (
    keyringAccountId: string,
  ): Promise<AccountActivity[]> => {
    const userOpHashes = await fetchUserOpHashes(keyringAccountId);
    const accountActivity: AccountActivity[] = []
    for (const userOpHash of userOpHashes) {
      accountActivity.push(
        {
          type: AccountActivityType.SmartContract,
          userOpHash,
          userOperationReceipt: await getUserOperationReceipt(userOpHash),
        }
      )
    }

    const txHashes = await getTxHashes(keyringAccountId, state.chainId);
    for (const txHash of txHashes) {
      accountActivity.push(
        {
          type: AccountActivityType.EOA,
          txHash,
          userOpHash: '',
          userOperationReceipt: null,
        }
      )
    }
    dispatch({
      type: MetamaskActions.SetAccountActivity,
      payload: accountActivity,
    });

    return accountActivity;
  };

  const getBundlerUrls = async (): Promise<BundlerUrls> => {
    const urls = await bundlerUrls();
    dispatch({
      type: MetamaskActions.SetBundlerUrls,
      payload: urls,
    });

    return urls
  };

  const updateChainId = async (chainId?: string) => {
    dispatch({
      type: MetamaskActions.SetChainId,
      payload: chainId ? chainId : await getChainId(),
    });
  };

  const getWalletChainId = async (): Promise<string> => {
    return await getChainId()
  };

  const setChainIdListener = async () => {
    if (!state.isChainIdListener) {   
      const provider = getMMProvider()
      if (provider) {
        provider.on('chainChanged', async (chainId) => {
          dispatch({
            type: MetamaskActions.SetChainId,
            payload: chainId,
          });
        });

        dispatch({
          type: MetamaskActions.SetWalletListener,
          payload: true,
        });
      }
    }
  };

  return {
    getKeyringSnapAccounts,
    selectKeyringSnapAccount,
    getSmartAccount,
    createAccount,
    deleteAccount,
    setChainIdListener,
    getAccountActivity,
    getBundlerUrls,
    updateChainId,
    getWalletChainId,
    sendRequest,
    approveRequest,
    rejectRequest,
    updateAccountBalance,
    rejectAllPendingRequests,
  }
}