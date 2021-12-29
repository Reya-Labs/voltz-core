import { ethers } from "hardhat";
import { TraderTest } from "../../typechain/TraderTest";

describe("Trader", () => {
  let traderTest: TraderTest;

  beforeEach("debloy TraderTest", async () => {
    const traderFactory = await ethers.getContractFactory("Trader");
    const _trader = await traderFactory.deploy();

    const traderTestFactory = await ethers.getContractFactory("TraderTest");
    traderTest = (await traderTestFactory.deploy()) as TraderTest;
    return { traderTest };
  });

  // describe( '#get', async () => {
  //     it('get the struct values', async () => {
  //         await traderTest
  //     })
  // })

  // describe( '#updateMargin', async () => {
  //     it('check if the Margin is updated', async () => {
  //         // const [owner] = await ethers.getSigners();
  //     // the first await activates the struct
  //     // const trader = await traderTest.setTrader(owner.address, toBn('0'), toBn('0'), toBn('0'), true);
  //     // the second await fills the function
  //         await traderTest.updateMargin(1);
  //         expect(traderTest[margin]).to.eq(0);
  //         });
  //     });

  //     describe( "#updateBalances", async () => {
  //         it("check if the Balance is updated", async () => {
  //             // const [owner] = await ethers.getSigners();
  //             // await traderTest.setTrader(owner.address, toBn('0'), toBn('0'), toBn('0'), false);
  //             const updated = await traderTest.updateBalances(0, 0);
  //             // const {
  //             //     margin,
  //             //     fixedTokenBalance,
  //             //     variableTokenBalance,
  //             //     isSettled,
  //             // } = await traderTest.traders(owner.address);
  //             expect(updated, 'traderTest [updatedBalances]').to.eq(0);
  //         });
  //     })
});
