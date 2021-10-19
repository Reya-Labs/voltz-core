import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants, Wallet } from 'ethers'
import { AMMFactory } from '../typechain/AMMFactory'
import { expect } from "chai";

import { MintFunction } from './shared/utilities';

const createFixtureLoader = waffle.createFixtureLoader

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T

describe("AMM", () => {

    let wallet: Wallet, other: Wallet
    let factory: AMMFactory

    
    let feeAmount: number
    let tickSpacing: number

    let minTick: number
    let maxTick: number

    let mint: MintFunction
    let loadFixture: ReturnType<typeof createFixtureLoader>
    
    
    before('create fixture loader', async () => {
        loadFixture = createFixtureLoader([wallet, other])
    })

    beforeEach('deploy fixture', async () => {
        
        // ;({ token0, token1, token2, factory, createPool, swapTargetCallee: swapTarget } = await loadFixture(poolFixture))



      })
    


})