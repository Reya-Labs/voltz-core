// hybrid of uniswap + new

// import the TickTest type

import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { TickTest } from "../../typechain/TickTest";
import { expect } from "../shared/expect";
import { toBn } from "evm-bn";
import { getMaxLiquidityPerTick, TICK_SPACING } from "../shared/utilities";
import { getMaxListeners } from "process";

// UniswapV3 part, is it needed?
const MaxUint128 = BigNumber.from(2).pow(128).sub(1);
//const { constants } = ether

describe("Tick", () => {
  let tickTest: TickTest;

  // before each function (it) the following is run (ie. deployed)
  beforeEach("deploy TickTest", async () => {
    const tickFactory = await ethers.getContractFactory("Tick");
    const tick = await tickFactory.deploy();

    const tickTestFactory = await ethers.getContractFactory("TickTest", {
      libraries: {
        Tick: tick.address,
      },
    });

    tickTest = (await tickTestFactory.deploy()) as TickTest;
  });
  // Needs Test cases
  describe("#checkTicks", () => {
    it("returns checks of both ticks", async () => {
      expect(tickTest.checkTicks(3, 2)).to.be.revertedWith("TLU");
    });
  });

  // Needs Test cases
  // getFeeGrowthInside
  describe("#getFeeGrowthInside", () => {
    it("returns all for two unitialised ticks if tick inside", async () => {
      await tickTest.setTick(2, {
        liquidityGross: 3,
        liquidityNet: 4,
        fixedTokenGrowthOutside: toBn("100"),
        variableTokenGrowthOutside: toBn("-100"),
        feeGrowthOutside: toBn("10"),
        initialized: true,
      });
      const feeGrowthInside = await tickTest.getFeeGrowthIntside(0, 0, 0, 0);
      expect(feeGrowthInside).to.eq(0);
    });
  });

  // AB get back to this
  // // Needs Test cases
  // // tickSpacingToMaxLiquidityPerTick
  // describe('#tickSpacingToMaxLiquidityPerTick', () => {
  //     it('returns the correct value for low fee', async () => {
  //         const maxLiquidityPerTick = await tickTest.tickSpacingToMaxLiquidityPerTick(TICK_SPACINGS[FeeAmount.LOW])
  //         expect(maxLiquidityPerTick).to.eq('1917569901783203986719870431555990')
  //         expect(maxLiquidityPerTick).to.eq(getMaxLiquidityPerTick(TICK_SPACINGS[FeeAmount.LOW]))
  //     })
  // })

  // Needs Test cases
  describe("#getVariableTokenGrowthInside", () => {
    it("test for variable token growth", async () => {
      await tickTest.setTick(2, {
        liquidityGross: 3,
        liquidityNet: 4,
        fixedTokenGrowthOutside: toBn("100"),
        variableTokenGrowthOutside: toBn("-100"),
        feeGrowthOutside: toBn("10"),
        initialized: true,
      });
      const variableTokenGrowthInside =
        await tickTest.getVariableTokenGrowthInside(0, 0, 0, 0);
      expect(variableTokenGrowthInside).to.eq(0);
    });
  });

  // Needs Test cases
  describe("#getFixedTokenGrowthInside", () => {
    it("test for fixed token growth", async () => {
      await tickTest.setTick(2, {
        liquidityGross: 3,
        liquidityNet: 4,
        fixedTokenGrowthOutside: toBn("100"),
        variableTokenGrowthOutside: toBn("-100"),
        feeGrowthOutside: toBn("10"),
        initialized: true,
      });
      const fixedTokenGrowthInside = await tickTest.getFixedTokenGrowthInside(
        0,
        0,
        0,
        0
      );
      expect(fixedTokenGrowthInside).to.eq(0);
    });
  });

  // Needs Test cases
  describe("#cross", () => {
    it("flips the growth variables", async () => {
      await tickTest.setTick(2, {
        liquidityGross: 3,
        liquidityNet: 4,
        fixedTokenGrowthOutside: toBn("100"),
        variableTokenGrowthOutside: toBn("-100"),
        feeGrowthOutside: toBn("10"),
        initialized: true,
      });

      await tickTest.cross(2, toBn("1000"), toBn("-2000"), toBn("10"));

      const {
        liquidityGross,
        liquidityNet,
        fixedTokenGrowthOutside,
        variableTokenGrowthOutside,
        feeGrowthOutside,
        initialized,
      } = await tickTest.ticks(2);

      expect(liquidityGross).to.eq(3);
      expect(liquidityNet).to.eq(4);
    });
  });

  // Needs Test cases
  // callStatic ?
  // describe('#update', async () => {
  //     it('does not flip from nonzero to greater nonzero', async () => {
  //         await tickTest.update(0, 0, 1, toBn("1000"), toBn("-2000"), toBn("10"), false, 3)
  //         expect(await tickTest.callStatic.update(0, 0, 1, toBn("1000"), toBn("-2000"),  toBn("10"), false, 3)).to.eq(false)
  //     })
  // })

  // Needs Test cases
  describe("#clear", async () => {
    it("deletes all the data in the tick", async () => {
      await tickTest.setTick(2, {
        liquidityGross: 3,
        liquidityNet: 4,
        fixedTokenGrowthOutside: toBn("100"),
        variableTokenGrowthOutside: toBn("-100"),
        feeGrowthOutside: toBn("10"),
        initialized: true,
      });
      await tickTest.clear(2);
      const {
        liquidityGross,
        liquidityNet,
        fixedTokenGrowthOutside,
        variableTokenGrowthOutside,
        feeGrowthOutside,
        initialized,
      } = await tickTest.ticks(2);
      expect(liquidityGross).to.eq(0);
      expect(liquidityNet).to.eq(0);
      expect(fixedTokenGrowthOutside).to.eq(0);
      expect(variableTokenGrowthOutside).to.eq(0);
      expect(feeGrowthOutside).to.eq(0);
      expect(initialized).to.eq(false);
    });
  });
});
