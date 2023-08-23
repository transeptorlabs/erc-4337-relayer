import { Buffer } from 'buffer';
import { Common, Hardfork } from '@ethereumjs/common';
import { JsonTx, TransactionFactory } from '@ethereumjs/tx';
import {
  Address,
  ecsign,
  stripHexPrefix,
  toBuffer,
  toChecksumAddress,
} from '@ethereumjs/util';
import {
  SignTypedDataVersion,
  TypedDataV1,
  TypedMessage,
  concatSig,
  personalSign,
  recoverPersonalSignature,
  signTypedData,
} from '@metamask/eth-sig-util';
import {
  Keyring,
  KeyringAccount,
  KeyringRequest,
  SubmitRequestResponse,
} from '@metamask/keyring-api';
import type { Json, JsonRpcRequest } from '@metamask/utils';
import { v4 as uuid } from 'uuid';

import { SimpleAccountAPI } from '@account-abstraction/sdk';
import { Wallet as EthersWallet, ethers } from 'ethers';
import {
  isEvmChain,
  serializeTransaction,
  isUniqueAccountName,
} from '../utils';
import { storeKeyRing } from '../state/state';
import { SigningMethods } from './permissions';

export type KeyringState = {
  wallets: Record<string, Wallet>;
  pendingRequests: Record<string, KeyringRequest>;
};

export type Wallet = {
  account: KeyringAccount;
  privateKey: string;
};

export class SimpleKeyring implements Keyring {
  #wallets: Record<string, Wallet>;

  #pendingRequests: Record<string, KeyringRequest>;

  constructor(state: KeyringState) {
    this.#wallets = state.wallets;
    this.#pendingRequests = state.pendingRequests;
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    return Object.values(this.#wallets).map((wallet) => wallet.account);
  }

  async getAccount(id: string): Promise<KeyringAccount | undefined> {
    return this.#wallets[id].account;
  }

  async createAccount(
    name: string,
    options: Record<string, Json> | null = null,
  ): Promise<KeyringAccount> {
    const { privateKey, address } = await this.#generateKeyPair(name);

    if (!isUniqueAccountName(name, Object.values(this.#wallets))) {
      throw new Error(`Account name already in use: ${name}`);
    }

    const account: KeyringAccount = {
      id: uuid(),
      name,
      options,
      address,
      supportedMethods: [
        'eth_sendTransaction',
        'eth_sign',
        'eth_signTransaction',
        'eth_signTypedData_v1',
        'eth_signTypedData_v2',
        'eth_signTypedData_v3',
        'eth_signTypedData_v4',
        'eth_signTypedData',
        'personal_sign',
      ],
      type: 'eip155:erc4337',
    };

    this.#wallets[account.id] = { account, privateKey };
    await this.#saveState();

    await snap.request({
      method: 'snap_manageAccounts',
      params: {
        method: 'createAccount',
        params: { account },
      },
    });
    return account;
  }

  async filterAccountChains(_id: string, chains: string[]): Promise<string[]> {
    // The `id` argument is not used because all accounts created by this snap
    // are expected to be compatible with any EVM chain.
    return chains.filter((chain) => isEvmChain(chain));
  }

  async updateAccount(account: KeyringAccount): Promise<void> {
    const currentAccount = this.#wallets[account.id].account;
    const newAccount: KeyringAccount = {
      ...currentAccount,
      ...account,
      // Restore read-only properties.
      address: currentAccount.address,
      supportedMethods: currentAccount.supportedMethods,
      type: currentAccount.type,
      options: currentAccount.options,
    };

    if (!isUniqueAccountName(account.name, Object.values(this.#wallets))) {
      throw new Error(`Account name already in use: ${account.name}`);
    }

    this.#wallets[account.id].account = newAccount;
    await this.#saveState();

    await snap.request({
      method: 'snap_manageAccounts',
      params: {
        method: 'updateAccount',
        params: { account },
      },
    });
  }

  async deleteAccount(id: string): Promise<void> {
    delete this.#wallets[id];
    await this.#saveState();

    await snap.request({
      method: 'snap_manageAccounts',
      params: {
        method: 'deleteAccount',
        params: { id },
      },
    });
  }

  async listRequests(): Promise<KeyringRequest[]> {
    return Object.values(this.#pendingRequests);
  }

  async getRequest(id: string): Promise<KeyringRequest> {
    return this.#pendingRequests[id];
  }

  /* 
    This snap implements asynchronous implementation, the request is stored in queue of pending requests to be approved or rejected by the user.
  */
  async submitRequest(request: KeyringRequest): Promise<SubmitRequestResponse> {
    console.log('SNAPS/', ' submitRequest requests', JSON.stringify(request));

    if (request.request.id === '') {
      throw new Error('Request id is required');
    }

    this.#pendingRequests[request.request.id] = request;
    await this.#saveState();
    return {
      pending: true,
    };
  }

  async approveRequest(_id: string): Promise<void> {
    const request: KeyringRequest = await this.getRequest(_id);
    console.log('SNAPS/', ' approveRequest requests', JSON.stringify(request));
    const { method, params } = request.request as JsonRpcRequest;
    const signature = this.#handleSigningRequest(method, params || []);
    await snap.request({
      method: 'snap_manageAccounts',
      params: {
        method: 'submitResponse',
        params: { id: _id, result: signature },
      },
    });

    // TODO: handle sending userOp with smart account or eth transaction with smart account owner(keyring account)

    delete this.#pendingRequests[_id];
    await this.#saveState();
  }

  async rejectRequest(_id: string): Promise<void> {
    const request: KeyringRequest = await this.getRequest(_id);
    console.log('SNAPS/', ' rejectRequest requests', JSON.stringify(request));

    await snap.request({
      method: 'snap_manageAccounts',
      params: {
        method: 'submitResponse',
        params: { id: _id, result: null },
      },
    });

    delete this.#pendingRequests[_id];
    await this.#saveState();
  }

  async getSmartAccount(
    entryPointAddress: string,
    factoryAddress: string,
    keyringAccountId: string,
  ): Promise<SimpleAccountAPI> {
    const provider = new ethers.providers.Web3Provider(ethereum as any);
    const { privateKey } = this.#getWalletById(keyringAccountId);
    const owner = new EthersWallet(privateKey).connect(provider);

    const aa = new SimpleAccountAPI({
      provider,
      entryPointAddress,
      owner,
      factoryAddress,
      index: 0, // nonce value used when creating multiple accounts for the same owner
    });
    return aa;
  }

  #getWalletByAddress(address: string): Wallet {
    const walletMatch = Object.values(this.#wallets).find(
      (wallet) =>
        wallet.account.address.toLowerCase() === address.toLowerCase(),
    );

    if (walletMatch === undefined) {
      throw new Error(`Cannot find wallet for address: ${address}`);
    }
    return walletMatch;
  }

  #getWalletById(accountId: string): Wallet {
    const walletMatch = Object.values(this.#wallets).find(
      (wallet) => wallet.account.id.toLowerCase() === accountId.toLowerCase(),
    );

    if (walletMatch === undefined) {
      throw new Error(`Cannot find wallet for accountId: ${accountId}`);
    }
    return walletMatch;
  }

  /*
    Will generate a private key using a deterministic 256-bit value specific to the Snap and the user’s MetaMask account(i.e., snapId + MetaMask secret recovery phrase + account name as salt).
    This private key will be used to sign userOps for eip155:erc4337 type keyring account.
    Since the private key is generated deterministically, the user will be able to recover the same account for a given Snap version account name(human readable) and MetaMask SRP.
  */
  async #generateKeyPair(
    name: string,
  ): Promise<{ privateKey: string; address: string }> {
    const privKey = await snap.request({
      method: 'snap_getEntropy',
      params: {
        version: 1,
        salt: name,
      },
    });

    const privateKeyBuffer = Buffer.from(stripHexPrefix(privKey), 'hex');
    const address = toChecksumAddress(
      Address.fromPrivateKey(privateKeyBuffer).toString(),
    );
    return { privateKey: privateKeyBuffer.toString('hex'), address };
  }

  #handleSigningRequest(method: string, params: Json): Json {
    switch (method) {
      case 'personal_sign': {
        const [from, message] = params as string[];
        return this.#signPersonalMessage(from, message);
      }

      case 'eth_sendTransaction': {
        /* TODO: Handle sending user op to bundler node if the account type is eip155:erc4337  - (using personal_sign body for testing)
          - check if the account type is eip155:erc4337
          - if yes, then create and sign userOp with smart account owner (ie: keyring account)
          - if no, then sign the transaction as usual
          - an addiontal flag can be passed to override the default behaviour to send a regular transaction with the smart account owner  (ie: keyring account)
        */
        const [from2, message2] = params as string[];
        return this.#signPersonalMessage(from2, message2);
      }
      case 'eth_signTransaction':
      case SigningMethods.SignTransaction: {
        const [from, tx, opts] = params as [string, JsonTx, Json];
        return this.#signTransaction(from, tx, opts);
      }

      case 'eth_signTypedData':
      case 'eth_signTypedData_v1':
      case 'eth_signTypedData_v2':
      case 'eth_signTypedData_v3':
      case 'eth_signTypedData_v4': {
        const [from, data, opts] = params as [
          string,
          Json,
          { version: SignTypedDataVersion },
        ];
        return this.#signTypedData(from, data, opts);
      }

      case 'eth_sign': {
        const [from, data] = params as [string, string];
        return this.#signMessage(from, data);
      }

      default: {
        throw new Error(`EVM method not supported: ${method}`);
      }
    }
  }

  #signTransaction(from: string, tx: any, _opts: any): Json {
    // Patch the transaction to make sure that the `chainId` is a hex string.
    if (!tx.chainId.startsWith('0x')) {
      tx.chainId = `0x${parseInt(tx.chainId, 10).toString(16)}`;
    }

    const wallet = this.#getWalletByAddress(from);
    const privateKey = Buffer.from(wallet.privateKey, 'hex');
    const common = Common.custom(
      { chainId: tx.chainId },
      {
        hardfork:
          tx.maxPriorityFeePerGas || tx.maxFeePerGas
            ? Hardfork.London
            : Hardfork.Istanbul,
      },
    );

    const signedTx = TransactionFactory.fromTxData(tx, {
      common,
    }).sign(privateKey);

    return serializeTransaction(signedTx.toJSON(), signedTx.type);
  }

  #signTypedData(
    from: string,
    data: Json,
    opts: { version: SignTypedDataVersion } = {
      version: SignTypedDataVersion.V1,
    },
  ): string {
    const { privateKey } = this.#getWalletByAddress(from);
    const privateKeyBuffer = Buffer.from(privateKey, 'hex');

    return signTypedData({
      privateKey: privateKeyBuffer,
      data: data as unknown as TypedDataV1 | TypedMessage<any>,
      version: opts.version,
    });
  }

  #signPersonalMessage(from: string, message: string): string {
    const { privateKey } = this.#getWalletByAddress(from);
    const privateKeyBuffer = Buffer.from(privateKey, 'hex');
    const messageBuffer = Buffer.from(message.slice(2), 'hex');

    const signature = personalSign({
      privateKey: privateKeyBuffer,
      data: messageBuffer,
    });

    const recoveredAddress = recoverPersonalSignature({
      data: messageBuffer,
      signature,
    });

    if (recoveredAddress.toLowerCase() !== from.toLowerCase()) {
      throw new Error(
        `Signature verification failed for account "${from}" (got "${recoveredAddress}")`,
      );
    }

    return signature;
  }

  #signMessage(from: string, data: string): string {
    const { privateKey } = this.#getWalletByAddress(from);
    const privateKeyBuffer = Buffer.from(privateKey, 'hex');
    const message = stripHexPrefix(data);
    const signature = ecsign(Buffer.from(message, 'hex'), privateKeyBuffer);
    return concatSig(toBuffer(signature.v), signature.r, signature.s);
  }

  async #saveState(): Promise<void> {
    await storeKeyRing({
      wallets: this.#wallets,
      pendingRequests: this.#pendingRequests,
    } as KeyringState);
  }
}
