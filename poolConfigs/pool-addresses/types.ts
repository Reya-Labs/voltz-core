export type SinglePool = {
  marginEngine: string;
  vamm: string;
  decimals: number;
  deploymentBlock: number;
  rateOracleID: number;
};

export type NetworkPools = {
  [key: string]: SinglePool;
};

export type Pools = {
  [key: string]: NetworkPools;
};
