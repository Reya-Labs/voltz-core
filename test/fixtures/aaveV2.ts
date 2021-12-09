// import { Contract, Wallet } from 'ethers';
// // import "../../artifacts/contracts/interfaces/underlyingPool/IAaveLendingPool.sol/IAaveLendingPool.json";

// export interface AaveV2Fixture {
//   lendingPool: Contract;
// }

// const AAVE_V2_LENDING_POOL_ADDRESS: string = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9'

// const lendingPoolAbi = [
//   {
//     "inputs": [
//       {
//         "internalType": "address",
//         "name": "asset",
//         "type": "address"
//       }
//     ],
//     "name": "getReserveNormalizedIncome",
//     "outputs": [
//       {
//         "internalType": "uint256",
//         "name": "",
//         "type": "uint256"
//       }
//     ],
//     "stateMutability": "view",
//     "type": "function"
//   }
// ]

// export async function aaveV2Fixture(alice: Wallet): Promise<AaveV2Fixture> {
//   const lendingPool = new Contract(AAVE_V2_LENDING_POOL_ADDRESS, lendingPoolAbi, alice);
//   return {
//     lendingPool,
//   };
// }
