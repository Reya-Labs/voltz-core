// hybrid of uniswap + new

// import the TickTest type

// AB: to review

import { ethers } from "hardhat";
import { TickTest } from "../../typechain/TickTest";
import { expect } from "../shared/expect";
import { toBn } from "evm-bn";
import { TickMath } from "../shared/tickMath";

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
      await expect(
        tickTest.checkTicks(TickMath.MIN_TICK - 1, 3)
      ).to.be.revertedWith("TLM");
      await expect(
        tickTest.checkTicks(2, TickMath.MAX_TICK + 1)
      ).to.be.revertedWith("TUM");
      await expect(tickTest.checkTicks(3, 2)).to.be.revertedWith("TLU");
      await expect(tickTest.checkTicks(2, 3)).to.not.be.revertedWith;
    });
  });

  // getFeeGrowthInside
  describe("#getFeeGrowthInside", () => {
    beforeEach("initialize some ticks", async () => {
      await tickTest.setTick(2, {
        liquidityGross: 3,
        liquidityNet: 4,
        fixedTokenGrowthOutside: toBn("100"),
        variableTokenGrowthOutside: toBn("-100"),
        feeGrowthOutside: toBn("10"),
        initialized: true,
      });
      await tickTest.setTick(4, {
        liquidityGross: 6,
        liquidityNet: 8,
        fixedTokenGrowthOutside: toBn("200"),
        variableTokenGrowthOutside: toBn("-200"),
        feeGrowthOutside: toBn("20"),
        initialized: true,
      });
    });

    it("two unitialized ticks", async () => {
      const feeGrowthInside = await tickTest.getFeeGrowthInside(0, 0, 0, 0);
      expect(feeGrowthInside).to.eq(0);
    });

    it("between two initialized ticks", async () => {
      const feeGrowthInside = await tickTest.getFeeGrowthInside(
        2,
        4,
        3,
        toBn("50")
      );
      expect(feeGrowthInside).to.equal(toBn("20"));
    });

    it("after two initialized ticks", async () => {
      const feeGrowthInside = await tickTest.getFeeGrowthInside(
        2,
        4,
        6,
        toBn("50")
      );
      expect(feeGrowthInside).to.equal(toBn("10"));
    });

    // TODO: re-check this test after resolving Tick.sol:67
    // it("before two initialized ticks", async () => {
    //   const feeGrowthInside = await tickTest.getFeeGrowthInside(2, 4, 0, toBn("50"));
    //   console.log(feeGrowthInside.toBigInt().toString());
    //   expect(feeGrowthInside).to.equal(toBn("-10"));
    // });
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

  describe("#getVariableTokenGrowthInside", () => {
    beforeEach("initialize some ticks", async () => {
      await tickTest.setTick(2, {
        liquidityGross: 3,
        liquidityNet: 4,
        fixedTokenGrowthOutside: toBn("100"),
        variableTokenGrowthOutside: toBn("-100"),
        feeGrowthOutside: toBn("10"),
        initialized: true,
      });
      await tickTest.setTick(4, {
        liquidityGross: 6,
        liquidityNet: 8,
        fixedTokenGrowthOutside: toBn("200"),
        variableTokenGrowthOutside: toBn("-200"),
        feeGrowthOutside: toBn("20"),
        initialized: true,
      });
    });

    it("two unitialized ticks", async () => {
      const variableTokenGrowthInside =
        await tickTest.getVariableTokenGrowthInside(0, 0, 0, 0);
      expect(variableTokenGrowthInside).to.eq(0);
    });

    it("between two initialized ticks", async () => {
      const variableTokenGrowthInside =
        await tickTest.getVariableTokenGrowthInside(2, 4, 3, toBn("300"));
      expect(variableTokenGrowthInside).to.eq(toBn("600"));
    });

    it("after two initialized ticks", async () => {
      const variableTokenGrowthInside =
        await tickTest.getVariableTokenGrowthInside(2, 4, 6, toBn("300"));
      expect(variableTokenGrowthInside).to.eq(toBn("-100"));
    });

    it("before two initialized ticks", async () => {
      const variableTokenGrowthInside =
        await tickTest.getVariableTokenGrowthInside(2, 4, 0, toBn("300"));
      expect(variableTokenGrowthInside).to.eq(toBn("100"));
    });
  });

  describe("#getFixedTokenGrowthInside", () => {
    beforeEach("initialize some ticks", async () => {
      await tickTest.setTick(2, {
        liquidityGross: 3,
        liquidityNet: 4,
        fixedTokenGrowthOutside: toBn("100"),
        variableTokenGrowthOutside: toBn("-100"),
        feeGrowthOutside: toBn("10"),
        initialized: true,
      });
      await tickTest.setTick(4, {
        liquidityGross: 6,
        liquidityNet: 8,
        fixedTokenGrowthOutside: toBn("200"),
        variableTokenGrowthOutside: toBn("-200"),
        feeGrowthOutside: toBn("20"),
        initialized: true,
      });
    });

    it("two unitialized ticks", async () => {
      const fixedTokenGrowthInside = await tickTest.getFixedTokenGrowthInside(
        0,
        0,
        0,
        0
      );
      expect(fixedTokenGrowthInside).to.eq(0);
    });

    it("between two initialized ticks", async () => {
      const fixedTokenGrowthInside = await tickTest.getFixedTokenGrowthInside(
        2,
        4,
        3,
        toBn("300")
      );
      expect(fixedTokenGrowthInside).to.eq(toBn("0"));
    });

    it("after two initialized ticks", async () => {
      const fixedTokenGrowthInside = await tickTest.getFixedTokenGrowthInside(
        2,
        4,
        6,
        toBn("300")
      );
      expect(fixedTokenGrowthInside).to.eq(toBn("100"));
    });

    it("before two initialized ticks", async () => {
      const fixedTokenGrowthInside = await tickTest.getFixedTokenGrowthInside(
        2,
        4,
        0,
        toBn("300")
      );
      expect(fixedTokenGrowthInside).to.eq(toBn("-100"));
    });
  });

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
        feeGrowthOutside,
        liquidityGross,
        liquidityNet,
        fixedTokenGrowthOutside,
        variableTokenGrowthOutside,
      } = await tickTest.ticks(2);

      expect(liquidityGross).to.eq(3);
      expect(liquidityNet).to.eq(4);
      expect(fixedTokenGrowthOutside).to.eq(toBn("900"));
      expect(variableTokenGrowthOutside).to.eq(toBn("-1900"));
      expect(feeGrowthOutside).to.eq(toBn("0"));
    });
  });

  describe("#update", async () => {
    beforeEach("initialize tick", async () => {
      await tickTest.setTick(2, {
        liquidityGross: toBn("3"),
        liquidityNet: toBn("4"),
        fixedTokenGrowthOutside: toBn("100"),
        variableTokenGrowthOutside: toBn("-100"),
        feeGrowthOutside: toBn("10"),
        initialized: true,
      });
    });

    it("does not flip from nonzero to greater nonzero", async () => {
      expect(
        await tickTest.callStatic.update(
          2,
          0,
          toBn("1"),
          toBn("1000"),
          toBn("-2000"),
          toBn("10"),
          false,
          toBn("10")
        )
      ).to.eq(false);
    });

    it("flips from zero to nonzero", async () => {
      expect(
        await tickTest.callStatic.update(
          0,
          0,
          toBn("1"),
          toBn("1000"),
          toBn("-2000"),
          toBn("10"),
          false,
          toBn("10")
        )
      ).to.eq(true);
    });

    it("flips from nonzero to zero", async () => {
      expect(
        await tickTest.callStatic.update(
          2,
          0,
          toBn("-3"),
          toBn("1000"),
          toBn("-2000"),
          toBn("10"),
          false,
          toBn("10")
        )
      ).to.eq(true);
    });

    // TODO: to continue here
  });

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
