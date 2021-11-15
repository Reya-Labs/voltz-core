import { Decimal } from "decimal.js";
import { ethers, waffle } from "hardhat";
import { BigNumber, BigNumberish, Wallet, ContractTransaction } from "ethers";
import { AMMFactory } from "../typechain/AMMFactory";
import {
  aave_lending_pool_addr,
  term_in_days,
  usdc_mainnet_addr,
} from "./shared/constants";

import { expect } from "./shared/expect";

import {
  MintFunction,
  createAMMFunctions,
  getMinTick,
  getMaxTick,
  FeeAmount,
  TICK_SPACINGS,
  getMaxLiquidityPerTick,
  encodeSqrtRatioX96,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
  expandTo18Decimals,
} from "./shared/utilities";

import { formatPrice, formatTokenAmount } from "./shared/format";

import { AMMFixture, TEST_AMM_START_TIME } from "./shared/fixtures";

import { TestAMMCallee } from "../typechain/TestAMMCallee";

import { MockTimeAMM } from "../typechain/MockTimeAMM";

Decimal.config({ toExpNeg: -500, toExpPos: 500 });
const createFixtureLoader = waffle.createFixtureLoader;
const { constants } = ethers;

interface BaseSwapTestCase {
  zeroForOne: boolean;
  sqrtPriceLimit?: BigNumber;
}
interface SwapExact0For1TestCase extends BaseSwapTestCase {
  zeroForOne: true;
  exactOut: false;
  amount0: BigNumberish;
  sqrtPriceLimit?: BigNumber;
}
interface SwapExact1For0TestCase extends BaseSwapTestCase {
  zeroForOne: false;
  exactOut: false;
  amount1: BigNumberish;
  sqrtPriceLimit?: BigNumber;
}
interface Swap0ForExact1TestCase extends BaseSwapTestCase {
  zeroForOne: true;
  exactOut: true;
  amount1: BigNumberish;
  sqrtPriceLimit?: BigNumber;
}
interface Swap1ForExact0TestCase extends BaseSwapTestCase {
  zeroForOne: false;
  exactOut: true;
  amount0: BigNumberish;
  sqrtPriceLimit?: BigNumber;
}
interface SwapToHigherPrice extends BaseSwapTestCase {
  zeroForOne: false;
  sqrtPriceLimit: BigNumber;
}
interface SwapToLowerPrice extends BaseSwapTestCase {
  zeroForOne: true;
  sqrtPriceLimit: BigNumber;
}
type SwapTestCase =
  | SwapExact0For1TestCase
  | Swap0ForExact1TestCase
  | SwapExact1For0TestCase
  | Swap1ForExact0TestCase
  | SwapToHigherPrice
  | SwapToLowerPrice;

function swapCaseToDescription(testCase: SwapTestCase): string {
  const priceClause = testCase?.sqrtPriceLimit
    ? ` to price ${formatPrice(testCase.sqrtPriceLimit)}`
    : "";
  if ("exactOut" in testCase) {
    if (testCase.exactOut) {
      if (testCase.zeroForOne) {
        return `swap token0 for exactly ${formatTokenAmount(
          testCase.amount1
        )} token1${priceClause}`;
      } else {
        return `swap token1 for exactly ${formatTokenAmount(
          testCase.amount0
        )} token0${priceClause}`;
      }
    } else {
      if (testCase.zeroForOne) {
        return `swap exactly ${formatTokenAmount(
          testCase.amount0
        )} token0 for token1${priceClause}`;
      } else {
        return `swap exactly ${formatTokenAmount(
          testCase.amount1
        )} token1 for token0${priceClause}`;
      }
    }
  } else {
    if (testCase.zeroForOne) {
      return `swap token0 for token1${priceClause}`;
    } else {
      return `swap token1 for token0${priceClause}`;
    }
  }
}

type AMMFunctions = ReturnType<typeof createAMMFunctions>;

// can't use address zero because the ERC20 token does not allow it
const SWAP_RECIPIENT_ADDRESS = constants.AddressZero.slice(0, -1) + "1";
const POSITION_PROCEEDS_OUTPUT_ADDRESS =
  constants.AddressZero.slice(0, -1) + "2";

async function executeSwap(
  amm: MockTimeAMM,
  testCase: SwapTestCase,
  ammFunctions: AMMFunctions
): Promise<ContractTransaction> {
  let swap: ContractTransaction;
  if ("exactOut" in testCase) {
    if (testCase.exactOut) {
      if (testCase.zeroForOne) {
        swap = await ammFunctions.swap0ForExact1(
          testCase.amount1,
          SWAP_RECIPIENT_ADDRESS,
          testCase.sqrtPriceLimit
        );
      } else {
        swap = await ammFunctions.swap1ForExact0(
          testCase.amount0,
          SWAP_RECIPIENT_ADDRESS,
          testCase.sqrtPriceLimit
        );
      }
    } else {
      if (testCase.zeroForOne) {
        swap = await ammFunctions.swapExact0For1(
          testCase.amount0,
          SWAP_RECIPIENT_ADDRESS,
          testCase.sqrtPriceLimit
        );
      } else {
        swap = await ammFunctions.swapExact1For0(
          testCase.amount1,
          SWAP_RECIPIENT_ADDRESS,
          testCase.sqrtPriceLimit
        );
      }
    }
  } else {
    if (testCase.zeroForOne) {
      swap = await ammFunctions.swapToLowerPrice(
        testCase.sqrtPriceLimit,
        SWAP_RECIPIENT_ADDRESS
      );
    } else {
      swap = await ammFunctions.swapToHigherPrice(
        testCase.sqrtPriceLimit,
        SWAP_RECIPIENT_ADDRESS
      );
    }
  }
  return swap;
}

const DEFAULT_POOL_SWAP_TESTS: SwapTestCase[] = [
  // swap large amounts in/out
  //  {
  //   zeroForOne: true,
  //   exactOut: false,
  //   amount0: expandTo18Decimals(1),
  // },
  // {
  //   zeroForOne: false,
  //   exactOut: false,
  //   amount1: expandTo18Decimals(1),
  // },
  // {
  //   zeroForOne: true,
  //   exactOut: true,
  //   amount1: expandTo18Decimals(1),
  // },
  // {
  //   zeroForOne: false,
  //   exactOut: true,
  //   amount0: expandTo18Decimals(1),
  // },
  // swap large amounts in/out with a price limit
  {
    zeroForOne: true,
    exactOut: false,
    amount0: expandTo18Decimals(1),
    sqrtPriceLimit: BigNumber.from(encodeSqrtRatioX96(50, 100).toString()),
  },
  // {
  //   zeroForOne: false,
  //   exactOut: false,
  //   amount1: expandTo18Decimals(1),
  //   sqrtPriceLimit: BigNumber.from(encodeSqrtRatioX96(200, 100).toString()),
  // },
  // {
  //   zeroForOne: true,
  //   exactOut: true,
  //   amount1: expandTo18Decimals(1),
  //   sqrtPriceLimit: BigNumber.from(encodeSqrtRatioX96(50, 100).toString()),
  // },
  // {
  //   zeroForOne: false,
  //   exactOut: true,
  //   amount0: expandTo18Decimals(1),
  //   sqrtPriceLimit: BigNumber.from(encodeSqrtRatioX96(200, 100).toString()),
  // },
  // swap small amounts in/out
  // {
  //   zeroForOne: true,
  //   exactOut: false,
  //   amount0: 1000,
  // },
  // {
  //   zeroForOne: false,
  //   exactOut: false,
  //   amount1: 1000,
  // },
  // {
  //   zeroForOne: true,
  //   exactOut: true,
  //   amount1: 1000,
  // },
  // {
  //   zeroForOne: false,
  //   exactOut: true,
  //   amount0: 1000,
  // },
  // swap arbitrary input to price
  // {
  //   sqrtPriceLimit: BigNumber.from(encodeSqrtRatioX96(5, 2).toString()),
  //   zeroForOne: false,
  // },
  // {
  //   sqrtPriceLimit: BigNumber.from(encodeSqrtRatioX96(2, 5).toString()),
  //   zeroForOne: true,
  // },
  // {
  //   sqrtPriceLimit: BigNumber.from(encodeSqrtRatioX96(5, 2).toString()),
  //   zeroForOne: true,
  // },
  // {
  //   sqrtPriceLimit: BigNumber.from(encodeSqrtRatioX96(2, 5).toString()),
  //   zeroForOne: false,
  // },
];

interface Position {
  tickLower: number;
  tickUpper: number;
  liquidity: BigNumberish;
}

interface AMMTestCase {
  description: string;
  feeAmount: number;
  tickSpacing: number;
  startingPrice: BigNumber;
  positions: Position[];
  swapTests?: SwapTestCase[];
}

const TEST_AMMs: AMMTestCase[] = [
  // {
  //   description: 'low fee, 1:1 price, 2e18 max range liquidity',
  //   feeAmount: FeeAmount.LOW,
  //   tickSpacing: TICK_SPACINGS[FeeAmount.LOW],
  //   startingPrice: BigNumber.from(encodeSqrtRatioX96(1, 1).toString()),
  //   positions: [
  //     {
  //       tickLower: getMinTick(TICK_SPACINGS[FeeAmount.LOW]),
  //       tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.LOW]),
  //       liquidity: expandTo18Decimals(2),
  //     },
  //   ],
  // },

  // {
  //   description: 'medium fee, 1:1 price, 2e18 max range liquidity',
  //   feeAmount: FeeAmount.MEDIUM,
  //   tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
  //   startingPrice: BigNumber.from(encodeSqrtRatioX96(1, 1).toString()),
  //   positions: [
  //     {
  //       tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
  //       tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
  //       liquidity: expandTo18Decimals(2),
  //     },
  //   ],
  // },
  // {
  //   description: 'high fee, 1:1 price, 2e18 max range liquidity',
  //   feeAmount: FeeAmount.HIGH,
  //   tickSpacing: TICK_SPACINGS[FeeAmount.HIGH],
  //   startingPrice: BigNumber.from(encodeSqrtRatioX96(1, 1).toString()),
  //   positions: [
  //     {
  //       tickLower: getMinTick(TICK_SPACINGS[FeeAmount.HIGH]),
  //       tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.HIGH]),
  //       liquidity: expandTo18Decimals(2),
  //     },
  //   ],
  // },
  {
    description: "medium fee, 10:1 price, 2e18 max range liquidity",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: BigNumber.from(encodeSqrtRatioX96(10, 1).toString()),
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  // {
  //   description: 'medium fee, 1:10 price, 2e18 max range liquidity',
  //   feeAmount: FeeAmount.MEDIUM,
  //   tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
  //   startingPrice: BigNumber.from(encodeSqrtRatioX96(1, 10).toString()),
  //   positions: [
  //     {
  //       tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
  //       tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
  //       liquidity: expandTo18Decimals(2),
  //     },
  //   ],
  // },

  // {
  //   description: 'medium fee, 1:1 price, 0 liquidity, all liquidity around current price',
  //   feeAmount: FeeAmount.MEDIUM,
  //   tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
  //   startingPrice: BigNumber.from(encodeSqrtRatioX96(1, 1).toString()),
  //   positions: [
  //     {
  //       tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
  //       tickUpper: -TICK_SPACINGS[FeeAmount.MEDIUM],
  //       liquidity: expandTo18Decimals(2),
  //     },
  //     {
  //       tickLower: TICK_SPACINGS[FeeAmount.MEDIUM],
  //       tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
  //       liquidity: expandTo18Decimals(2),
  //     },
  //   ],
  // },
  // {
  //   description: 'medium fee, 1:1 price, additional liquidity around current price',
  //   feeAmount: FeeAmount.MEDIUM,
  //   tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
  //   startingPrice: BigNumber.from(encodeSqrtRatioX96(1, 1).toString()),
  //   positions: [
  //     {
  //       tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
  //       tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
  //       liquidity: expandTo18Decimals(2),
  //     },
  //     {
  //       tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
  //       tickUpper: -TICK_SPACINGS[FeeAmount.MEDIUM],
  //       liquidity: expandTo18Decimals(2),
  //     },
  //     {
  //       tickLower: TICK_SPACINGS[FeeAmount.MEDIUM],
  //       tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
  //       liquidity: expandTo18Decimals(2),
  //     },
  //   ],
  // },
  // {
  //   description: 'low fee, large liquidity around current price (stable swap)',
  //   feeAmount: FeeAmount.LOW,
  //   tickSpacing: TICK_SPACINGS[FeeAmount.LOW],
  //   startingPrice: BigNumber.from(encodeSqrtRatioX96(1, 1).toString()),
  //   positions: [
  //     {
  //       tickLower: -TICK_SPACINGS[FeeAmount.LOW],
  //       tickUpper: TICK_SPACINGS[FeeAmount.LOW],
  //       liquidity: expandTo18Decimals(2),
  //     },
  //   ],
  // },
  // {
  //   description: 'medium fee, token0 liquidity only',
  //   feeAmount: FeeAmount.MEDIUM,
  //   tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
  //   startingPrice: BigNumber.from(encodeSqrtRatioX96(1, 1).toString()),
  //   positions: [
  //     {
  //       tickLower: 0,
  //       tickUpper: 2000 * TICK_SPACINGS[FeeAmount.MEDIUM],
  //       liquidity: expandTo18Decimals(2),
  //     },
  //   ],
  // },
  // {
  //   description: 'medium fee, token1 liquidity only',
  //   feeAmount: FeeAmount.MEDIUM,
  //   tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
  //   startingPrice: BigNumber.from(encodeSqrtRatioX96(1, 1).toString()),
  //   positions: [
  //     {
  //       tickLower: -2000 * TICK_SPACINGS[FeeAmount.MEDIUM],
  //       tickUpper: 0,
  //       liquidity: expandTo18Decimals(2),
  //     },
  //   ],
  // },
  // {
  //   description: 'close to max price',
  //   feeAmount: FeeAmount.MEDIUM,
  //   tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
  //   startingPrice: BigNumber.from(encodeSqrtRatioX96(BigNumber.from(2).pow(127).toString(), 1).toString()),
  //   positions: [
  //     {
  //       tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
  //       tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
  //       liquidity: expandTo18Decimals(2),
  //     },
  //   ],
  // },

  // todo: more test cases left
];

describe("AMM IRS tests", () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet]);
  });

  for (const ammCase of TEST_AMMs) {
    describe(ammCase.description, () => {
      const ammCaseFixture = async () => {
        const {
          factory,
          swapTargetCallee: swapTarget,
          createAMM,
        } = await AMMFixture([wallet], waffle.provider);

        const amm = await createAMM(
          usdc_mainnet_addr,
          aave_lending_pool_addr,
          term_in_days,
          FeeAmount.MEDIUM,
          TICK_SPACINGS[FeeAmount.MEDIUM]
        );

        const ammFunctions = createAMMFunctions({ swapTarget, amm });
        await amm.initialize(ammCase.startingPrice);

        // mint all positions
        for (const position of ammCase.positions) {
          await ammFunctions.mint(
            wallet.address,
            position.tickLower,
            position.tickUpper,
            position.liquidity
          );
        }

        const [ammBalance0, ammBalance1] = await Promise.all([
          amm.balance0(),
          amm.balance1(),
        ]);

        return { amm, ammFunctions, ammBalance0, ammBalance1, swapTarget };
      };

      let ammBalance0: BigNumber;
      let ammBalance1: BigNumber;

      let amm: MockTimeAMM;
      let swapTarget: TestAMMCallee;
      let ammFunctions: AMMFunctions;

      beforeEach("load fixture", async () => {
        ({ amm, ammFunctions, ammBalance0, ammBalance1, swapTarget } =
          await loadFixture(ammCaseFixture));
      });

      // todo: implement once burn and collect are implemented
      // afterEach('check can burn positions', async () => {
      //   for (const { liquidity, tickUpper, tickLower } of poolCase.positions) {
      //     await pool.burn(tickLower, tickUpper, liquidity)
      //     await pool.collect(POSITION_PROCEEDS_OUTPUT_ADDRESS, tickLower, tickUpper, MaxUint128, MaxUint128)
      //   }
      // })

      for (const testCase of ammCase.swapTests ?? DEFAULT_POOL_SWAP_TESTS) {
        it(swapCaseToDescription(testCase), async () => {
          const slot0 = await amm.slot0();
          const tx = executeSwap(amm, testCase, ammFunctions);

          // todo: fix error handling: currently error TS2571: Object is of type 'unknown'. (error.message line)
          // try {
          //   await tx
          // } catch (error) {
          //   expect({
          //     swapError: error.message,
          //     ammBalance0: ammBalance0.toString(),
          //     ammBalance1: ammBalance1.toString(),
          //     ammPriceBefore: formatPrice(slot0.sqrtPriceX96),
          //     tickBefore: slot0.tick,
          //   }).to.matchSnapshot('swap error')
          //   return
          // }

          const [
            ammBalance0After,
            ammBalance1After,
            slot0After,
            liquidityAfter,
          ] = await Promise.all([
            amm.balance0(),
            amm.balance1(),
            amm.slot0(),
            amm.liquidity(),
          ]);

          const ammBalance0Delta = ammBalance0After.sub(ammBalance0);
          const ammBalance1Delta = ammBalance1After.sub(ammBalance1);

          // check that the swap event was emitteds
          // await expect(tx)
          // .to.emit(amm, 'Swap')
          // .withArgs(
          //   swapTarget.address,
          //   SWAP_RECIPIENT_ADDRESS,
          //   ammBalance0Delta,
          //   ammBalance1Delta,
          //   slot0After.sqrtPriceX96,
          //   liquidityAfter,
          //   slot0After.tick
          // )

          const executionPrice = new Decimal(ammBalance1Delta.toString())
            .div(ammBalance0Delta.toString())
            .mul(-1); // todo: why mul(-1) ?

          expect({
            // amount0Before: ammBalance0.toString(),
            // amount1Before: ammBalance1.toString(),
            // amount0Delta: ammBalance0Delta.toString(),
            // amount1Delta: ammBalance1Delta.toString(),
            tickBefore: slot0.tick,
            ammPriceBefore: formatPrice(slot0.sqrtPriceX96),
            tickAfter: slot0After.tick,
            poolPriceAfter: formatPrice(slot0After.sqrtPriceX96),
            executionPrice: executionPrice.toPrecision(5),
          }).to.matchSnapshot("balances");
        });
      }
    });
  }
});
