import { BigNumber } from "ethers";

export interface Datum {
  blockNumber: number;
  timestamp: number;
  rate: BigNumber;
  error: unknown;
  glpData?: {
    lastCummulativeReward: BigNumber;
    lastEthGlpPrice: BigNumber;
  };
}

export interface BlockSpec {
  fromBlock: number; // positive value = absolute block number; negative = offset from toBlock
  blockInterval: number;
  toBlock: number; //
}
