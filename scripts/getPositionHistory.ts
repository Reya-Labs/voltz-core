import { BigNumber, utils } from "ethers";
import { GraphQLClient, gql } from "graphql-request";
import { getProtocolSubgraphURL } from "./getProtocolSubgraphURL";

const getPositionHistoryQueryString = (id: string): string => `
  {
    positions(first: 10, where: {id: "${id}"}) {     
      mints {
        id
        sender
        transaction {
          id
          createdTimestamp
        }
        amount
      }

      burns {
        id 
        sender
        transaction {
          id
          createdTimestamp
        }
        amount
      }

      swaps {
        id 
        sender
        transaction {
          id
          createdTimestamp
        }
        desiredNotional
        sqrtPriceLimitX96
        cumulativeFeeIncurred
        fixedTokenDelta
        variableTokenDelta
        fixedTokenDeltaUnbalanced
      }

      marginUpdates {
        id 
        transaction {
          id
          createdTimestamp
        }
        depositer
        marginDelta
      }

      liquidations {
        id
        transaction {
          id
          createdTimestamp
        }
        liquidator
        reward
        notionalUnwound
      }

      settlements {
        id 
        transaction {
          id
          createdTimestamp
        }
        settlementCashflow
      }
    }
  }
`;

export type MintInfo = {
  sender: string;
  transaction: string;
  timestamp: number;
  notional: number;
};

export type BurnInfo = {
  sender: string;
  transaction: string;
  timestamp: number;
  notional: number;
};

export type SwapInfo = {
  sender: string;
  transaction: string;
  timestamp: number;
  fees: number;
  fixedTokenDelta: number;
  unbalancedFixedTokenDelta: number;
  variableTokenDelta: number;
};

export type MarginUpdateInfo = {
  depositer: string;
  transaction: string;
  timestamp: number;
  marginDelta: number;
};

export type LiquidationInfo = {
  liquidator: string;
  transaction: string;
  timestamp: number;
  reward: number;
};

export type SettlementInfo = {
  transaction: string;
  timestamp: number;
  settlementCashflow: number;
};

export class PositionHistory {
  public mints: MintInfo[] = [];
  public burns: BurnInfo[] = [];
  public swaps: SwapInfo[] = [];
  public marginUpdates: MarginUpdateInfo[] = [];
  public liquidations: LiquidationInfo[] = [];
  public settlements: SettlementInfo[] = [];

  public decimals: number;
  public tickLower: number;
  public tickUpper: number;
  public id: string;

  constructor(
    id: string,
    tickLower: number,
    tickUpper: number,
    decimals: number
  ) {
    this.id = id;
    this.tickLower = tickLower;
    this.tickUpper = tickUpper;
    this.decimals = decimals;
  }

  getNotional(liquidity: number) {
    return (
      liquidity *
      (1.0001 ** (this.tickUpper / 2) - 1.0001 ** (this.tickLower / 2))
    );
  }

  descale(x: BigNumber): number {
    return parseFloat(utils.formatUnits(x, this.decimals));
  }

  getMints(rawMints: any): MintInfo[] {
    const mints: MintInfo[] = [];

    for (const m of rawMints) {
      mints.push({
        sender: m.sender,
        transaction: m.transaction.id,
        notional: this.getNotional(this.descale(BigNumber.from(m.amount))),
        timestamp: Number(m.transaction.createdTimestamp),
      });
    }

    mints.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

    return mints;
  }

  getBurns(rawBurns: any): BurnInfo[] {
    const burns: BurnInfo[] = [];

    for (const b of rawBurns) {
      burns.push({
        sender: b.sender,
        transaction: b.transaction.id,
        notional: this.getNotional(this.descale(BigNumber.from(b.amount))),
        timestamp: Number(b.transaction.createdTimestamp),
      });
    }

    burns.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

    return burns;
  }

  getSwaps(rawSwaps: any): SwapInfo[] {
    const swaps: SwapInfo[] = [];

    for (const s of rawSwaps) {
      swaps.push({
        sender: s.sender,
        transaction: s.transaction.id,
        timestamp: Number(s.transaction.createdTimestamp),
        fees: this.descale(BigNumber.from(s.cumulativeFeeIncurred)),
        fixedTokenDelta: this.descale(BigNumber.from(s.fixedTokenDelta)),
        unbalancedFixedTokenDelta: this.descale(
          BigNumber.from(s.fixedTokenDeltaUnbalanced)
        ),
        variableTokenDelta: this.descale(BigNumber.from(s.variableTokenDelta)),
      });
    }

    swaps.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

    return swaps;
  }

  getMarginUpdates(rawMarginUpdates: any): MarginUpdateInfo[] {
    const marginUpdates: MarginUpdateInfo[] = [];

    for (const mu of rawMarginUpdates) {
      marginUpdates.push({
        depositer: mu.depositer,
        transaction: mu.transaction.id,
        timestamp: Number(mu.transaction.createdTimestamp),
        marginDelta: this.descale(BigNumber.from(mu.marginDelta)),
      });
    }

    marginUpdates.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

    return marginUpdates;
  }

  getLiquidations(rawLiquidations: any): LiquidationInfo[] {
    const liquidations: LiquidationInfo[] = [];

    for (const l of rawLiquidations) {
      liquidations.push({
        liquidator: l.liquidator,
        transaction: l.transaction.id,
        timestamp: Number(l.transaction.createdTimestamp),
        reward: this.descale(BigNumber.from(l.reward)),
      });
    }

    liquidations.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

    return liquidations;
  }

  getSettlements(rawSettlements: any): SettlementInfo[] {
    const settlements: SettlementInfo[] = [];

    for (const s of rawSettlements) {
      settlements.push({
        transaction: s.transaction.id,
        timestamp: Number(s.transaction.createdTimestamp),
        settlementCashflow: this.descale(BigNumber.from(s.settlementCashflow)),
      });
    }

    settlements.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

    return settlements;
  }

  async getInfo(networkName: string) {
    const endpoint = getProtocolSubgraphURL(networkName);
    const graphQLClient = new GraphQLClient(endpoint);

    console.log("id:", this.id);
    const data = await graphQLClient.request(
      gql`
        ${getPositionHistoryQueryString(this.id)}
      `
    );

    const positions_batch = JSON.parse(JSON.stringify(data, undefined, 2));
    const positions = positions_batch.positions;

    if (positions.length === 0) {
      throw new Error("No position found in subgraph.");
    }

    if (positions.length >= 2) {
      throw new Error("Can't have multiple positions with the same IDs.");
    }

    const positionHistory = positions[0];

    this.mints = this.getMints(positionHistory.mints);
    this.burns = this.getBurns(positionHistory.burns);
    this.swaps = this.getSwaps(positionHistory.swaps);
    this.marginUpdates = this.getMarginUpdates(positionHistory.marginUpdates);
    this.liquidations = this.getLiquidations(positionHistory.liquidations);
    this.settlements = this.getSettlements(positionHistory.settlements);
  }
}
