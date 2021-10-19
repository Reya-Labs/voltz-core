import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants, Wallet } from 'ethers'
import { AMMFactory } from '../typechain/AMMFactory'
import { expect } from "chai";

import { MintFunction, createAMMFunctions, getMinTick, getMaxTick, FeeAmount, TICK_SPACINGS,
        getMaxLiquidityPerTick, encodeSqrtRatioX96} from './shared/utilities';

import { AMMFixture, TEST_AMM_START_TIME } from './shared/fixtures'

import { TestAMMCallee } from '../typechain/TestAMMCallee'

import { MockTimeAMM } from '../typechain/MockTimeAMM'


const createFixtureLoader = waffle.createFixtureLoader

const usdc_mainnet_addr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const aave_lending_pool_addr = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9'
const term_in_days = 30

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T

describe("AMM", () => {

    let wallet: Wallet, other: Wallet
    let factory: AMMFactory
    let amm: MockTimeAMM


    let swapTarget: TestAMMCallee

    
    let feeAmount: number
    let tickSpacing: number

    let minTick: number
    let maxTick: number

    let mint: MintFunction
    let loadFixture: ReturnType<typeof createFixtureLoader>
    
    let createAMM: ThenArg<ReturnType<typeof AMMFixture>>['createAMM']


    before('create fixture loader', async () => {
        ;[wallet, other] = await (ethers as any).getSigners()
        loadFixture = createFixtureLoader([wallet, other])
    })


    beforeEach('deploy fixture', async () => {
        
        ;({ factory, swapTargetCallee:swapTarget, createAMM} = await loadFixture(AMMFixture))

        const oldCreateAMM = createAMM

        createAMM = async (_underlyingToken, _underlyingPool, _termInDays, _fee, _tickSpacing) => {
            const amm = await oldCreateAMM(_underlyingToken, _underlyingPool, _termInDays, _fee, _tickSpacing)
            
            ;({
              mint,
            } = createAMMFunctions({
                swapTarget,
                amm,
            }))
            minTick = getMinTick(_tickSpacing)
            maxTick = getMaxTick(_tickSpacing)
            feeAmount = _fee
            tickSpacing = _tickSpacing
            return amm
          }
        
        // default to the 30 bips (Medium fee amount) amm
        amm = await createAMM(usdc_mainnet_addr, aave_lending_pool_addr, term_in_days, FeeAmount.MEDIUM, TICK_SPACINGS[FeeAmount.MEDIUM])

      })

      it('constructor initializes immutables', async () => {
        expect(await amm.factory()).to.eq(factory.address)

        expect(await amm.underlyingToken()).to.eq(usdc_mainnet_addr)
        
        expect(await amm.underlyingPool()).to.eq(aave_lending_pool_addr)

        expect(await amm.termInDays()).to.eq(term_in_days)

        expect(await amm.fee()).to.eq(FeeAmount.MEDIUM)

        expect(await amm.tickSpacing()).to.eq(TICK_SPACINGS[FeeAmount.MEDIUM])

        expect(await amm.maxLiquidityPerTick()).to.eq(getMaxLiquidityPerTick(tickSpacing))
      })
    

      describe('#initialize', () => {

        it("fails if already initialized", async () => {
            await amm.initialize(encodeSqrtRatioX96(1, 1).toString())
            await expect(amm.initialize(encodeSqrtRatioX96(1, 1).toString())).to.be.reverted
        })

      })

    
})