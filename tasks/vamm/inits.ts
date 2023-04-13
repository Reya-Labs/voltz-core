type InitVAMM = {
  pool: string;
  initialFixedRate: number;
};

// Example:
//   const example: MintParams = {
//     pool: "glpETH_v2",
//     initialFixedRate: 25, // 25%
//    };

const init: InitVAMM = {
  pool: "glpETH_v3",
  initialFixedRate: 25.596,
};

export const inits: InitVAMM[] = [init];
