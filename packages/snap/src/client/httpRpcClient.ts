import { Wallet, ethers } from 'ethers';
import { EntryPoint__factory } from '@account-abstraction/contracts';

export class HttpRpcClient {
  private readonly provider: ethers.providers.JsonRpcProvider;

  private readonly bundlerUrl: string;

  private readonly chainId: number;

  private readonly DEFAULT_ENTRY_POINT =
    '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

  private readonly DEFAULT_ACCOUNT_FACTORY =
    '0x9406Cc6185a346906296840746125a0E44976454';

  private readonly bundlerMap: Map<number, string> = new Map([
    [1337, 'http://localhost:3000/rpc'],
  ]);

  constructor(chainId: number) {
    const bundlerUrl = this.bundlerMap.get(chainId);
    if (!bundlerUrl) {
      throw new Error(`ChainId ${chainId} not supported`);
    }
    this.bundlerUrl = bundlerUrl;
    this.chainId = chainId;
    this.provider = new ethers.providers.JsonRpcProvider(this.bundlerUrl, {
      name: 'Connected Transeptor Bundler Node',
      chainId: this.chainId,
    });
  }

  public getEntryPointAddr(): string {
    return this.DEFAULT_ENTRY_POINT;
  }

  public getAccountFactoryAddr(): string {
    return this.DEFAULT_ACCOUNT_FACTORY;
  }

  public getEntryPointContract(signer: Wallet): ethers.Contract {
    return new ethers.Contract(
      this.DEFAULT_ENTRY_POINT,
      EntryPoint__factory.abi,
      signer,
    );
  }

  public getBundlerChainId(): number {
    return this.chainId;
  }

  public async send(method: string, params: any[]): Promise<any> {
    const result = await this.provider.send(method, params);
    return result;
  }
}
