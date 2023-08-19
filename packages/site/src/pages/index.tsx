import { useContext, useEffect, useState } from 'react';
import styled from 'styled-components';
import { MetamaskActions, MetaMaskContext, useAcount } from '../hooks';
import {
  connectSnap,
  getSnap,
  shouldDisplayReconnectButton,
  convertToEth, 
  clearActivityData,
  parseChainId,
  addBundlerUrl,
  trimAccount,
} from '../utils';
import {
  ConnectSnapButton,
  InstallFlaskButton,
  ReconnectButton,
  Card,
  CommonInputForm,
  SimpleButton,
  TabMenu,
  BundlerInputForm,
} from '../components';
import { AppTab, BundlerUrls, SupportedChainIdMap } from '../types';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  margin-top: 1.6rem;
  margin-bottom: 7.6rem;
  ${({ theme }) => theme.mediaQueries.small} {
    padding-left: 2.4rem;
    padding-right: 2.4rem;
    margin-bottom: 2rem;
    width: auto;
  }
`;

const CardContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  max-width: 64.8rem;
  width: 100%;
  height: 100%;
  margin-top: 1.5rem;
`;

const Notice = styled.div`
  background-color: ${({ theme }) => theme.colors.background.alternative};
  border: 1px solid ${({ theme }) => theme.colors.border.default};
  color: ${({ theme }) => theme.colors.text.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;

  & > * {
    margin: 0;
  }
  ${({ theme }) => theme.mediaQueries.small} {
    margin-top: 1.2rem;
    padding: 1.6rem;
  }
`;

const ErrorMessage = styled.div`
  background-color: ${({ theme }) => theme.colors.error.muted};
  border: 1px solid ${({ theme }) => theme.colors.error.default};
  color: ${({ theme }) => theme.colors.error.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-bottom: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;
  ${({ theme }) => theme.mediaQueries.small} {
    padding: 1.6rem;
    margin-bottom: 1.2rem;
    margin-top: 1.2rem;
    max-width: 100%;
  }
`;

const LineBreak = styled.hr`
  color: ${(props) => props.theme.colors.primary};
  border: solid 1px ${(props) => props.theme.colors.border.default};
  width: 60%;
  ${({ theme }) => theme.mediaQueries.small} {
    width: 80%;
  }
`;

const Index = () => {
  const [state, dispatch] = useContext(MetaMaskContext);
  const [depositAmount, setDepositAmount] = useState('');
  const [withDrawAddr, setWithDrawAddr] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [formBundlerUrls, setFormBundlerUrls] = useState({} as BundlerUrls);
  const [accountName, setAccountName] = useState('');
  const [accountNameDelete, setAccountNameDelete] = useState('');

  const {
    getKeyringSnapAccounts, 
    createAccount, 
    deleteAccount, 
    selectKeyringSnapAccount,
    getSmartAccount,
    getAccountActivity,
    getBundlerUrls,
    updateChainId,
    setChainIdListener,
  } = useAcount();

  useEffect(() => {
    async function initNetwork() {
      if (state.isFlask) {
        await updateChainId()
        await setChainIdListener()
      }
    }

    initNetwork().catch((error) => dispatch({ type: MetamaskActions.SetError, payload: error }));
  }, [state.isFlask]);

  useEffect(() => {
    async function initAccounts() {
      if (state.installedSnap) {
        const account = await getKeyringSnapAccounts()
        await handleFetchBundlerUrls()
        if (account.length > 0) {
          await selectKeyringSnapAccount(account[0]);
          await getSmartAccount(account[0].id);
          await getAccountActivity(account[0].id);
        }
      }
    }

    initAccounts().catch((error) => dispatch({ type: MetamaskActions.SetError, payload: error }));
  }, [state.installedSnap]);


  // useEffect(() => {
  //   let interval: any
  //   try {  
  //     interval = setInterval(async () => {
  //       if (state.eoa.connected === true && state.scAccount.connected === true) {
  //         await Promise.all([
  //           refreshEOAState(state.eoa.address),
  //           getScAccountState(state.eoa.address),
  //           getAccountActivity(state.eoa.address, Number(state.scAccount.index)),
  //         ]);
  //       }
  //     }, 10000) // 10 seconds
  
  //     return () => {
  //       clearInterval(interval);
  //     };

  //   } catch (e) {
  //     console.error('[ERROR] refreaher:', e.message);
  //     dispatch({ type: MetamaskActions.SetError, payload: e });
  //   } 
  // }, [state.eoa, state.scAccount, state.smartAccountActivity]);


  const handleFetchBundlerUrls = async () => {
    const urls = await getBundlerUrls();
    setFormBundlerUrls(urls);
  };

  const createBundlerUrlForm = () => {
    return (
      <div>
        {Object.entries(formBundlerUrls).map(([chainId, url]) => (
          <BundlerInputForm
            key={chainId}
            onSubmitClick={(e)=> handleBundlerUrlSubmit(e, chainId)}
            buttonText="Save"
            onInputChange={(e)=> handleBundlerUrlChange(e, chainId)}
            inputValue={url}
            inputPlaceholder="Enter url"
            networkName={SupportedChainIdMap[chainId] ? SupportedChainIdMap[chainId].name : 'Unknown'}
            chainId={parseChainId(chainId).toString()}
        />
        ))}
      </div>
    );
  };

  // Click handlers
  const handleReConnectSnapClick = async (event: any) => {
    try {
      event.preventDefault();
      await connectSnap();
      const installedSnap = await getSnap();
      dispatch({
        type: MetamaskActions.SetInstalled,
        payload: installedSnap,
      });

    } catch (e) {
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const handleCreateAccount = async (event: any) => {
    event.preventDefault();
    const newAccount = await createAccount(accountName)
    await selectKeyringSnapAccount(newAccount);
    await getSmartAccount(newAccount.id);
    setAccountName('')
  };

  const handleDeleteAccount = async (event: any) => {
    event.preventDefault();
    let keyringAccountIdFound = ''
    state.snapKeyring.accounts.forEach(account => {
      if (account.name === accountNameDelete)
      keyringAccountIdFound =  account.id
    })

    if (keyringAccountIdFound === '') {
      dispatch({ type: MetamaskActions.SetError, payload: new Error('Account name not found.') });
    } else {
      await deleteAccount(keyringAccountIdFound)

      // update selected to first account when the deleted account it the current selected account
      if(keyringAccountIdFound === state.selectedSnapKeyringAccount.id) {
        const accounts = await getKeyringSnapAccounts()
        if (accounts.length > 0) {
          await selectKeyringSnapAccount(accounts[0]);
          await getSmartAccount(accounts[0].id);
          await getAccountActivity(accounts[0].id);
        } else {
          dispatch({ type: MetamaskActions.SetClearAccount, payload: true })
        }
      }
      setAccountNameDelete('')
    }
  };

  // const handleDepositSubmit = async (e: any) => {
  //   e.preventDefault();
  //   const depositInWei = convertToWei(depositAmount);

  //   // check the owner account has enough balance
  //   if (BigNumber.from(state.eoa.balance).lt(depositInWei)) {
  //     dispatch({ type: MetamaskActions.SetError, payload: new Error('EOA has, insufficient funds.') });
  //     return;
  //   }
    
  //   const entryPointContract = getEntryPointContract(state.scAccount.entryPoint);

  //   // estimate gas
  //   const encodedFunctionData = await encodeFunctionData(
  //     getEntryPointContract(state.scAccount.entryPoint),
  //     'depositTo',
  //     [state.scAccount.address]
  //   );
  //   const estimateGasAmount = await estimateGas(
  //     state.eoa.address,
  //     state.scAccount.entryPoint,
  //     encodedFunctionData,
  //   );

  //   const provider = new ethers.providers.Web3Provider(getMMProvider() as any);

  //   const overrides = {
  //     value: depositInWei.toString(),
  //     gasPrice: await provider.getGasPrice(),
  //     gasLimit: estimateGasAmount.toNumber(),
  //   };
  //   const result = await entryPointContract.depositTo(state.scAccount.address, overrides).catch((error: any) => dispatch({ type: MetamaskActions.SetError, payload: error }));
  //   if (!result) {
  //     return;
  //   }
  //   const rep = await result.wait();
    
  //   // refresh account balances
  //   setDepositAmount('');
  //   await refreshEOAState(state.eoa.address);
  //   await getScAccountState(state.eoa.address);
  // }

  // const handleWithdrawSubmit = async (e: any) => {
  //   e.preventDefault();
  //   const withdrawAmountInWei = convertToWei(withdrawAmount);
  //   if (!isValidAddress(withDrawAddr)) {
  //     dispatch({ type: MetamaskActions.SetError, payload: new Error('Invalid address') });
  //     return;
  //   }

  //   if (BigNumber.from(state.scAccount.deposit).lt(withdrawAmountInWei)) {
  //     dispatch({ type: MetamaskActions.SetError, payload: new Error('Smart contract account, insufficient deposit') });
  //     return;
  //   }

  //   try {
  //     const encodedFunctionData = await encodeFunctionData(
  //       getEntryPointContract(state.scAccount.entryPoint),
  //       'withdrawTo',
  //       [state.eoa.address, withdrawAmountInWei.toString()]
  //     );

  //     await sendUserOperation(
  //       state.scAccount.entryPoint,
  //       encodedFunctionData,
  //       state.eoa.address,
  //     );

  //     setWithdrawAmount('');
  //     setWithDrawAddr('');
  //     await refreshEOAState(state.eoa.address);
  //     await getScAccountState(state.eoa.address);
  //     await getAccountActivity(state.eoa.address, Number(state.scAccount.index))
  //   } catch (e) {
  //     dispatch({ type: MetamaskActions.SetError, payload: e });
  //   }
  // }

  const handleClearActivity = async (e: any) => {
    e.preventDefault();
    await clearActivityData();
    await handleFetchBundlerUrls();
  }

  const handleBundlerUrlSubmit = async (e: any, chainId: string) => {
    e.preventDefault();
    await addBundlerUrl(chainId, formBundlerUrls[chainId]);
    await handleFetchBundlerUrls();
  }

  // Input handlers
  const handleDepositAmountChange = async (e: any) => {
    // Regular expression to match only numbers
    const inputValue = e.target.value;
    const numberRegex = /^\d*\.?\d*$/;
    if (inputValue === '' || numberRegex.test(inputValue)) {
      setDepositAmount(e.target.value);
    }
  }

  const handleWithdrawAmountChange = async (e: any) => {
    // Regular expression to match only numbers
    const inputValue = e.target.value;
    const numberRegex = /^\d*\.?\d*$/;
    if (inputValue === '' || numberRegex.test(inputValue)) {
      setWithdrawAmount(e.target.value);
    }
  }

  const handleWithdrawAddrChange = async (e: any) => {
    const inputValue = e.target.value;
    const charRegex = /^[A-Za-z0-9.]*$/;
    if (inputValue === '' || charRegex.test(inputValue)) {
      setWithDrawAddr(e.target.value);
    }
  }

  const handleBundlerUrlChange = async (e: any, chainId: string) => {
    const inputValue = e.target.value;
    setFormBundlerUrls({
      ...formBundlerUrls,
      [chainId]: inputValue,
    })
  }

  const handleAccountNameChange = async (e: any) => {
    setAccountName(e.target.value);
  }

  const handleAccountNameDelete = async (e: any) => {
    setAccountNameDelete(e.target.value);
  }

  return (
    <Container>
      <TabMenu></TabMenu>
      <LineBreak></LineBreak>

      {/* Init state */}
      <CardContainer>
        {!state.isFlask && (
          <Card
            content={{
              title: 'Install',
              description:
                'Snaps is pre-release software only available in MetaMask Flask, a canary distribution for developers with access to upcoming features.',
              button: <InstallFlaskButton />,
            }}
            fullWidth
          />
        )}

        {!state.installedSnap && (
          <Card
            content={{
              title: 'Connect ERC-4337 Relayer',
              description: 'Features include:',
              listItems: [
                'Access and control smart accounts with MetaMask. Enjoy smart contract functionality with ease and convenience.',
                'Manage ERC-4337 accounts(create, sign, send, transfer funds)',
                'Manage stake and deposit with supported entrypoint contracts',
              ],
              button: <ConnectSnapButton onClick={handleReConnectSnapClick}/>
            }}
            disabled={!state.isFlask}
            fullWidth
          />
        )}
      </CardContainer>
  
      {/* Error message */}
      {state.error && (
        <ErrorMessage>
          <b>An error happened:</b> {state.error.message}
        </ErrorMessage>
      )}

      {/* Account tab (eoa details, smart account details, smart account activity)*/}
      {state.activeTab === AppTab.SmartAccount && (
        <CardContainer>
          {state.scAccount.connected && state.installedSnap && (
            <Card
              content={{
                description: `${state.scAccount.address}`,
                descriptionBold: `${state.selectedSnapKeyringAccount.name}`,
                stats: [
                  {
                    id: `0`,
                    title: 'owner',
                    value: `${trimAccount(state.scAccount.ownerAddress)}`,
                  },
                  {
                    id: `1`,
                    title: 'Deposit',
                    value: `${convertToEth(state.scAccount.deposit)} ETH`,
                  },
                  {
                    id: `2`,
                    title: 'Balance',
                    value: `${convertToEth(state.scAccount.balance)} ETH`,
                  },
                  {
                    id: `3`,
                    title: 'Nonce',
                    value: `${(state.scAccount.nonce)}`,
                  },
                ],
                // form: [
                //   <CommonInputForm
                //   key={"withdraw"}
                //   onSubmitClick={handleWithdrawSubmit}
                //   buttonText="Withdraw Deposit"
                //   inputs={[
                //       {
                //         id: "1",
                //         onInputChange: handleWithdrawAddrChange,
                //         inputValue: withDrawAddr,
                //         inputPlaceholder:"Enter address"
                //       },
                //       {
                //         id: "2",
                //         onInputChange: handleWithdrawAmountChange,
                //         inputValue: withdrawAmount,
                //         inputPlaceholder:"Enter amount"
                //       }
                //     ]
                //   }
                // />
                // ]
              }}
              disabled={!state.isFlask}
              copyDescription
              isAccount
              fullWidth
            />
          )}
          
          {state.scAccount.connected && state.installedSnap && (
            <Card
              content={{
                title: 'Activity',
                smartAccountActivity: state.smartAccountActivity,
              }}
              disabled={!state.isFlask}
              fullWidth
            />
          )}

          {state.installedSnap && state.snapKeyring.accounts.length === 0 && (
            <Card
              content={{
                title: 'Create a Smart Account',
                form: [
                  <CommonInputForm
                    key={"create"}
                    buttonText="Create"
                    onSubmitClick={handleCreateAccount}
                    inputs={[
                      {
                        id: "1",
                        onInputChange: handleAccountNameChange,
                        inputValue: accountName,
                        inputPlaceholder:"Enter account name"
                      }
                    ]}
                  />,
                ],
              }}
              disabled={!state.isFlask}
              fullWidth
            />
          )}
        </CardContainer>
      )}

      {state.activeTab === AppTab.Management && (
        <CardContainer>
          {state.installedSnap && (
            <Card
              content={{
                title: 'Create a Smart Account',
                form: [
                  <CommonInputForm
                    key={"create"}
                    buttonText="Create"
                    onSubmitClick={handleCreateAccount}
                    inputs={[
                      {
                        id: "1",
                        onInputChange: handleAccountNameChange,
                        inputValue: accountName,
                        inputPlaceholder:"Enter account name"
                      }
                    ]}
                  />,
                ],
              }}
              disabled={!state.isFlask}
              fullWidth
            />
          )}

          {state.installedSnap && state.snapKeyring.accounts.length > 0 && (
            <Card
              content={{
                title: 'Delete Smart Account',
                form: [
                  <CommonInputForm
                    key={"delete"}
                    buttonText="delete"
                    onSubmitClick={handleDeleteAccount}
                    inputs={[
                      {
                        id: "1",
                        onInputChange: handleAccountNameDelete,
                        inputValue: accountNameDelete,
                        inputPlaceholder:"Enter account name"
                      }
                    ]}
                  />,
                ],
              }}
              disabled={!state.isFlask}
              fullWidth
            />
          )}
        </CardContainer>
      )}

      {/* Setting tab */}
      {state.activeTab === AppTab.Settings && (
        <CardContainer>

          {state.installedSnap && (
            <Card
              content={{
                title: 'Bundler RPC Urls',
                description: 'A list of bundler RPC Url to relay your user operations.',
                custom: createBundlerUrlForm()
              }}
              disabled={!state.isFlask}
              fullWidth
            />
          )}

          {state.installedSnap && (
            <Card
              content={{
                title: 'ERC-4337 Relayer is installed and ready to use',
                description: `Installed with v${state.installedSnap.version}. Use MetaMask settings page, to see the more details on the installed snap.`,
              }}
              disabled={!state.isFlask}
              fullWidth
            />
          )}

          {shouldDisplayReconnectButton(state.installedSnap) && (
            <Card
              content={{
                title: 'Local dev - Reconnect snap',
                description:
                  'While connected to a local running snap this button will always be displayed in order to update the snap if a change is made.',
                button: (
                  <ReconnectButton
                    onClick={handleReConnectSnapClick}
                    disabled={!state.installedSnap}
                  />
                ),
              }}
              disabled={!state.installedSnap}
              fullWidth
            />
          )}

          {state.installedSnap && (
              <ErrorMessage>
                <p>This resets your smart account's activity and bundler Url inside the Snap. Your balances and incoming transactions won't change.</p>
              <SimpleButton text={'Clear activity data'} onClick={handleClearActivity}></SimpleButton>
            </ErrorMessage>
          )}
        </CardContainer>
      )}

      <Notice>
          <p>
            Please note that the this snap is only available in MetaMask Flask,
            and is actively being developed by{' '}
            <a href="https://github.com/transeptorlabs" target="_blank">
              Transeptor Labs
            </a>
          </p>
      </Notice>
    </Container>
  );
};

export default Index;
