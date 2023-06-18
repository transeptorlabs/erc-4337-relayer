import { ReactNode } from 'react';
import styled from 'styled-components';
import { FaCopy } from "react-icons/fa";
import { trimAccount } from '../utils/eth';
import { UserOperationReceipt } from '../types';
import { BigNumber } from 'ethers';
import { Blockie } from './blockie';

type CardProps = {
  content: {
    title?: string;
    description?: string;
    descriptionBold?: string;
    button?: ReactNode;
    listItems?: string[];
    stats?: {
      id: string;
      title: string;
      value: string;
    }[];
    form?: ReactNode[];
    userOperationReceipts?: UserOperationReceipt[]
  };
  disabled?: boolean;
  fullWidth?: boolean;
  copyDescription?: boolean;
  isAccount?: boolean;
};

const CardWrapper = styled.div<{ fullWidth?: boolean; disabled: boolean }>`
  display: flex;
  flex-direction: column;
  width: ${({ fullWidth }) => (fullWidth ? '100%' : '250px')};
  background-color: ${({ theme }) => theme.colors.card.default};
  margin-top: 2.4rem;
  margin-bottom: 2.4rem;
  padding: 2.4rem;
  border: 1px solid ${({ theme }) => theme.colors.border.default};
  border-radius: ${({ theme }) => theme.radii.default};
  box-shadow: ${({ theme }) => theme.shadows.default};
  filter: opacity(${({ disabled }) => (disabled ? '.4' : '1')});
  align-self: stretch;
  ${({ theme }) => theme.mediaQueries.small} {
    width: 100%;
    margin-top: 1.2rem;
    margin-bottom: 1.2rem;
    padding: 1.6rem;
  }
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes.large};
  margin: 0;
  margin-bottom: 1.6rem;
  ${({ theme }) => theme.mediaQueries.small} {
    font-size: ${({ theme }) => theme.fontSizes.text};
  }
`;

const FlexRow = styled.div`
  display: flex;
  flex-direction: row;
  margin-bottom: 1.2rem;
`;

const FlexRowNoMargin = styled.div`
  display: flex;
  flex-direction: row;
`;

const Description = styled.div`
  display: flex;
  flex-direction: column;
  margin: 0;
  display: inherit;
  ${({ theme }) => theme.mediaQueries.small} {
    display: none;
  }
`;

const DescriptionText = styled.p`
  margin: 0;
`;

const DescriptionTextBold = styled.p` 
  margin: 0;
  font-weight: bold;
`;


const DescriptionMobile = styled.div`
  display: flex;
  flex-direction: column;
  margin: 0;
  display: none;
  ${({ theme }) => theme.mediaQueries.small} {
    display: inherit;
  }
`;

const DescriptionCopy = styled.div`
  margin-left: 1rem;
  margin-top: auto;
  margin-bottom: auto;
  margin-right: 1rem;
  &:hover {
    color: ${({ theme }) => theme.colors.primary.main};
    cursor: pointer;
  }
`;

const FormContainer = styled.div`
`;

const StatsContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const FlexContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  ${({ theme }) => theme.mediaQueries.small} {
    flex-direction: column;
  }
`;

const ActivityItemContainer = styled.div`
  display: flex;
  flex-direction: column;
  width:: 100%;
  background-color: ${({ theme }) => theme.colors.card.default};
  margin-top: 0;
  margin-bottom: 2.4rem;
  padding: 2.4rem;  
  border: 1px solid ${({ theme }) => theme.colors.border.default};
  border-radius: ${({ theme }) => theme.radii.default};
  box-shadow: ${({ theme }) => theme.shadows.default};
  align-self: stretch;
  ${({ theme }) => theme.mediaQueries.small} {
    margin-top: 1.2rem;
    margin-bottom: 1.2rem;
    padding: 0;
  }
`;

const ActivityItem = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  ${({ theme }) => theme.mediaQueries.small} {
    flex-direction: column;
    padding: 2.4rem;  
  }
`;

const ActivityCopy = styled.div`
  margin-left: 1rem;
  margin-top: auto;
  margin-bottom: auto;
  &:hover {
    color: ${({ theme }) => theme.colors.primary.main};
    cursor: pointer;
  }
`;

const ActivitySuccess = styled.span`
  color: ${({ theme }) => theme.colors.success.alternative};
`

const ActivityFailed = styled.span`
  color: ${({ theme }) => theme.colors.error.alternative};
`

export const Card = ({ content, disabled = false, fullWidth, copyDescription, isAccount }: CardProps) => {
  const { title, description, descriptionBold, button, listItems, form, stats, userOperationReceipts} = content;

  const handleCopyToClipboard = (event: any, text: string) => {
    event.preventDefault();
    if (text) {
      navigator.clipboard.writeText(text);    
    }
  }
  
  return (
    <CardWrapper fullWidth={fullWidth} disabled={disabled}>
      {title && (
        <Title>{title}</Title>
      )}

      {description && (   
        <FlexRow>
          {isAccount && (
            <Blockie></Blockie>
            )
          }

          <Description>
            {descriptionBold && (
              <DescriptionTextBold>
                {descriptionBold}
              </DescriptionTextBold>
              )
            }
            <DescriptionText>
              {isAccount ? `eth: ${description}` : description }
            </DescriptionText>
          </Description>

          <DescriptionMobile>
            {descriptionBold && (
              <DescriptionTextBold>
                {descriptionBold}
              </DescriptionTextBold>
              )
            }
            <DescriptionText>
              {isAccount ? `eth: ${trimAccount(description)}` : description }
            </DescriptionText>
          </DescriptionMobile>
          
          {copyDescription && (
            <DescriptionCopy onClick={e => handleCopyToClipboard(e, description)}>
              <FaCopy />
            </DescriptionCopy>
          )}
        </FlexRow>
      )}

      {listItems && (
        <ul>
          {
            listItems.map((item: string) => (
            <li key={item}>{item}</li>
          ))
          }
        </ul>
      )}
      {button}

      <FlexContainer>
        {stats &&
          <StatsContainer>
            {
              stats.map((item: { id: string, title: string; value: string; }) => (
                <Stat key={item.id}>
                  <p>{item.title}</p>
                  <p>{item.value}</p>
                </Stat>
              ))
            }
          </StatsContainer>
        }
        <FormContainer>
          {form &&
            form.map((item: ReactNode) => (
              item
          ))}
        </FormContainer>
      </FlexContainer>

      {userOperationReceipts && (
        userOperationReceipts.map((item: UserOperationReceipt) => (
          <ActivityItemContainer key={`${item.sender}-${item.nonce.toString()}-${item.receipt.transactionHash}`}>
            <ActivityItem>
              <p>Status:</p>
              <p>{item.success? <ActivitySuccess>Confirmed</ActivitySuccess>: <ActivityFailed>Failed</ActivityFailed>}</p>
            </ActivityItem>

            {!item.success && item.reason && (
              <ActivityItem>
                <p>Revert:</p>
                <p>{item.reason}</p>
              </ActivityItem>
            )}
           
            <ActivityItem>
              <p>Sender:</p>
              <FlexRowNoMargin>
                <p>eth:{trimAccount(item.sender)}</p>
                <ActivityCopy onClick={e => handleCopyToClipboard(e, item.sender)}>
                  <FaCopy />
                </ActivityCopy>
              </FlexRowNoMargin>
            </ActivityItem>

            <ActivityItem>
              <p>To:</p>
              <FlexRowNoMargin>
                <p>eth:{trimAccount(item.receipt.to)}</p>
                <ActivityCopy onClick={e => handleCopyToClipboard(e, item.receipt.to)}>
                  <FaCopy />
                </ActivityCopy>
              </FlexRowNoMargin>
            </ActivityItem>
           
            <ActivityItem>
              <p>Nonce:</p>
              <p>{BigNumber.from(item.nonce).toNumber()}</p>
            </ActivityItem>

            <ActivityItem>
              <p>Gas Used(units):</p>
              <p>{BigNumber.from(item.actualGasUsed).toNumber()}</p>
            </ActivityItem>

            <ActivityItem>
              <p>Gas Cost(Wei):</p>
              <p>{BigNumber.from(item.actualGasCost).toNumber()}</p>
            </ActivityItem>

              <ActivityItem>
                <p>Transaction hash:</p>
                <FlexRowNoMargin>
                  <p>{trimAccount(item.receipt.transactionHash)}</p>
                  <ActivityCopy onClick={e => handleCopyToClipboard(e, item.receipt.transactionHash)}>
                    <FaCopy />
                  </ActivityCopy>
                </FlexRowNoMargin>
              </ActivityItem>      
          </ActivityItemContainer>
        ))
      )}
    </CardWrapper>
  );
};
