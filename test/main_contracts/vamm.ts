// hybrid of uniswap v3 pool and new
import { ethers, waffle } from 'hardhat';
import { BigNumber, BigNumberish, constants, Wallet } from 'ethers';
import { Factory } from '../../typechain/Factory';
import { TestVAMM } from '../../typechain/TestVAMM';
import { expect } from '../shared/expect';
import { vammFixture, ammFixture } from '../shared/fixtures';
import { TestVAMMCallee } from '../../typechain/TestVAMMCallee';
import {
    getPositionKey,
    getMaxTick,
    getMinTick,
    TICK_SPACING,
    createVAMMMFunctions,
    SwapFunction,
    MintFunction,
    getMaxLiquidityPerTick,
    MaxUint128,
    MAX_SQRT_RATIO,
    MIN_SQRT_RATIO,
    encodeSqrtRatioX96,
    SwapToPriceFunction,
  } from '../shared/utilities';
import { consts } from "../helpers/constants";
// import { devConstants, mainnetConstants } from "../helpers/constants";
import { mainnetConstants } from '../../scripts/helpers/constants';
import { RATE_ORACLE_ID } from '../shared/utilities';
import { getCurrentTimestamp } from "../helpers/time";
const { provider } = waffle;
import { toBn } from "evm-bn";


const createFixtureLoader = waffle.createFixtureLoader;
type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;


describe('VAMM', () => {
    let wallet: Wallet, other: Wallet;
    let factory: Factory;
    let vammTest: TestVAMM;
    let vammCalleeTest: TestVAMMCallee;
    
    let swapToLowerPrice: SwapToPriceFunction;
    let swapToHigherPrice: SwapToPriceFunction;
    let swapExact0For1: SwapFunction;
    let swap0ForExact1: SwapFunction;
    let swapExact1For0: SwapFunction;
    let swap1ForExact0: SwapFunction;
    let tickSpacing: number;
    let minTick: number;
    let maxTick: number;
    let mint: MintFunction;
    let loadFixture: ReturnType<typeof createFixtureLoader>;
    let createVAMM: ThenArg<ReturnType<typeof vammFixture>>['createVAMM'];
    let createAMM: ThenArg<ReturnType<typeof ammFixture>>['createAMM'];

    before('create fixture loader', async () => {
        ;[wallet, other] = await (ethers as any).getSigners()
        loadFixture = createFixtureLoader([wallet, other])
    })

    beforeEach('deploy fixture', async () => {

      const termStartTimestamp: number = await getCurrentTimestamp(provider);
      const termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY.toNumber();
      const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
      const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

      ;({factory, createAMM } = await loadFixture(ammFixture));
      const amm = await createAMM(mainnetConstants.tokens.USDC.address, RATE_ORACLE_ID, termStartTimestampBN, termEndTimestampBN);

      ;({factory, createVAMM, vammCalleeTest } = await loadFixture(vammFixture));
      const oldCreateVAMM = createVAMM;
      
      createVAMM = async (_ammAddress: string) => {
          const vamm = await oldCreateVAMM(_ammAddress);
          ;({
              swapToLowerPrice,
              swapExact0For1,
              mint
            } = createVAMMMFunctions({
              vammCalleeTest,
              vammTest
          }));

          minTick = getMinTick(TICK_SPACING);
          maxTick = getMaxTick(TICK_SPACING);

          tickSpacing = TICK_SPACING;

          return vamm;
        }
        
      // vammTest = await createVAMM(amm.address);
      vammTest = await oldCreateVAMM(amm.address);

    })

    it('constructor initializes immutables', async () => {
        expect(true).to.eq(false);
        // expect(await pool.factory()).to.eq(factory.address)
        // expect(await pool.token0()).to.eq(token0.address)
        // expect(await pool.token1()).to.eq(token1.address)
        // expect(await pool.maxLiquidityPerTick()).to.eq(getMaxLiquidityPerTick(tickSpacing))
    })
})






