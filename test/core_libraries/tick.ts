// hybrid of uniswap + new

// import the TickTest type

import { ethers } from 'hardhat'
import { BigNumber } from 'ethers'
// NEED TO IMPORT THE CORRECT TYPE
import { TickTest } from '../../typechain/TickTest'
import { expect } from '../shared/expect'
import { toBn } from "evm-bn";

const BLOCK_TIMESTAMP = 1632249308;

// UniswapV3 part, is it needed?
const MaxUint128 = BigNumber.from(2).pow(128).sub(1)
//const { constants } = ether

// the beginning of the contract
describe('Tick', () => {
    let tickTest: TickTest
    
    // before each function (it) the following is run (ie. deployed)
    beforeEach('deploy TickTest', async () => {
        const tickFactory = await ethers.getContractFactory(
            "Tick"
         );
        const tick = await tickFactory.deploy();

        const tickTestFactory = await ethers.getContractFactory(
            "TickTest",
          {
            libraries: {
            Tick: tick.address,
            },
          }
        );
        
        tickTest = await tickTestFactory.deploy() as TickTest;        
        
    })  
    describe( '#checkTicks', () => {
        it('returns checks of both ticks', async () => {
            // const checkTicksRequires = await tickTest.checkTicks(3, 2)
            expect(tickTest.checkTicks(3, 2)).to.be.revertedWith('TLU')
        })
    })

    describe('#cross', () => {
        it('flips the growth variables', async () => {
            await tickTest.setTick(
                2,{
                    liquidityGross: 3,
                    liquidityNet: 4,
                    fixedTokenGrowthOutside: toBn("100"),
                    variableTokenGrowthOutside: toBn("-100"),
                    feeGrowthOutside: toBn("10"),
                    initialized: true
                }
            );

            await tickTest.cross(2, toBn("1000"), toBn("-2000"), toBn("10"));

            const {
                liquidityGross,
                liquidityNet,
                fixedTokenGrowthOutside,
                variableTokenGrowthOutside,
                feeGrowthOutside,
                initialized
            } = await tickTest.ticks(2);

            expect(liquidityGross).to.eq(3);
            expect(liquidityNet).to.eq(4);

        })
    })

    describe('#update', async () => {
        it('does not flip from nonzero to greater nonzero', async () => {
            await tickTest.update(0, 0, 1, toBn("1000"), toBn("-2000"), toBn("10"), false, 3)
            expect(await tickTest.callStatic.update(0, 0, 1, toBn("1000"), toBn("-2000"),  toBn("10"), false, 3)).to.eq(false)
        })

        // Weird test, STATIC?
        // it('flips from zero to nonzero', async () => {
        //     expect(await tickTest.callStatic.update(0, 0, 1, toBn("1000"), toBn("-2000"),  toBn("10"), false, 3)).to.eq(true);
        // })

    })
    
    // function clear, is TESTED
    describe('#clear', async () => {
        it('deletes all the data in the tick', async () => {
            await tickTest.setTick(2, {
                liquidityGross: 3,
                liquidityNet: 4,
                fixedTokenGrowthOutside: toBn("100"),
                variableTokenGrowthOutside: toBn("-100"),
                feeGrowthOutside: toBn("10"),
                initialized: true
            })
            await tickTest.clear(2)
            const {
                liquidityGross,
                liquidityNet,
                fixedTokenGrowthOutside,
                variableTokenGrowthOutside,
                feeGrowthOutside,
                initialized
            } = await tickTest.ticks(2)
            expect(liquidityGross).to.eq(0)
            expect(liquidityNet).to.eq(0)
            expect(fixedTokenGrowthOutside).to.eq(0)
            expect(variableTokenGrowthOutside).to.eq(0)
            expect(feeGrowthOutside).to.eq(0)
            expect(initialized).to.eq(false)
        })
    })
})
