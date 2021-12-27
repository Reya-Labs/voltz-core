import { ethers, waffle } from 'hardhat'
import { BigNumber } from 'ethers'
import { TraderTest } from '../../typechain/TraderTest'
import { expect } from '../shared/expect'
import { toBn } from 'evm-bn'
import { div, sub, mul, add } from "../shared/functions";

describe("Trader", () => {
    let traderTest: TraderTest;

    beforeEach('debloy TraderTest', async () => {
        const traderFactory = await ethers.getContractFactory("Trader");
        const trader = await traderFactory.deploy();

        const traderTestFactory = await ethers.getContractFactory("TraderTest");
        traderTest = await traderTestFactory.deploy() as TraderTest;
    });

    describe( '#updateMargin', async () => {
        it('check if the Margin is updated', async () => {
            const [owner] = await ethers.getSigners();
        // the first await activates the struct
        // const trader = await traderTest.setTrader(owner.address, toBn('0'), toBn('0'), toBn('0'), true);
        // the second await fills the function
            const updatedMargin = await traderTest.updateMargin(1);
            expect(updatedMargin).to.eq(0);
            });
        });

    describe( "#updateBalances", async () => {
        it("check if the Balance is updated", async () => {
            const [owner] = await ethers.getSigners();
            // await traderTest.setTrader(owner.address, toBn('0'), toBn('0'), toBn('0'), false);
            const updated = await traderTest.updateBalances(0, 0);
            // const {
            //     margin,
            //     fixedTokenBalance,
            //     variableTokenBalance,
            //     isSettled,
            // } = await traderTest.traders(owner.address);
            expect(updated).to.eq(0);
        });
    })
});
