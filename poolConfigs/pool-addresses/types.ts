export type IndividualPool = {
  marginEngine: string;
  vamm: string;
  decimals: number;
  deploymentBlock: number;
  rateOracleID: number;
};

export type NetworkPools = {
  [key: string]: IndividualPool;
};

export type Pools = {
  [key: string]: NetworkPools;
};
