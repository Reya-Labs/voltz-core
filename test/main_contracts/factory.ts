import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { Factory } from "../../typechain/Factory";
import { expect } from "../shared/expect";
import {
  metaFixture,
  fixedAndVariableMathFixture,
  marginCalculatorFixture,
  mockAaveLendingPoolFixture,
} from "../shared/fixtures";
import { getCurrentTimestamp } from "../helpers/time";
import { toBn } from "evm-bn";
import { consts } from "../helpers/constants";
import {
  ERC20Mock,
  MockAaveLendingPool,
  TestRateOracle,
} from "../../typechain";
import { ZERO_ADDRESS } from "../shared/utilities";
const { provider } = waffle;
const createFixtureLoader = waffle.createFixtureLoader;

describe("Factory", () => {
  let wallet: Wallet, other: Wallet;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  describe("#updateOwner", () => {
    let factory: Factory;

    beforeEach("deploy fixture", async () => {
      ({ factory } = await loadFixture(metaFixture));
    });

    it("check setOwner", async () => {
      // check initial owner
      expect(await factory.owner()).to.equal(wallet.address);

      // change owner
      await factory.setOwner(other.address);

      // check final owner
      expect(await factory.owner()).to.equal(other.address);
    });
  });

  describe("#updateCalculator", () => {
    let factory: Factory;

    beforeEach("deploy fixture", async () => {
      ({ factory } = await loadFixture(metaFixture));
    });

    it("check calculator", async () => {
      // create new calculator
      const { fixedAndVariableMath } = await fixedAndVariableMathFixture();

      const { testMarginCalculator } = await marginCalculatorFixture(
        fixedAndVariableMath.address,
        factory.address
      );

      // check initial calculator
      expect(await factory.calculator()).to.not.equal(
        testMarginCalculator.address
      );

      // change calculator
      factory.setCalculator(testMarginCalculator.address);

      // check final calculator
      expect(await factory.calculator()).to.equal(testMarginCalculator.address);
    });
  });

  describe("#createAMM", () => {
    let factory: Factory;
    let token: ERC20Mock;
    let termStartTimestamp: number;
    let termEndTimestamp: number;
    let termEndTimestampBN: BigNumber;
    let testRateOracle: TestRateOracle;

    beforeEach("deploy fixture", async () => {
      ({ factory, token, testRateOracle } = await loadFixture(metaFixture));
      termStartTimestamp = await getCurrentTimestamp(provider);
      termEndTimestamp = termStartTimestamp + consts.ONE_WEEK.toNumber();
      termEndTimestampBN = toBn(termEndTimestamp.toString());
    });

    it("checkOwnerPrivilege", async () => {
      await expect(
        factory
          .connect(other)
          .createAMM(token.address, testRateOracle.address, termEndTimestampBN)
      ).to.be.revertedWith("NOT_OWNER");
    });

    it("checkCreateAMM", async () => {
      // create AMM
      const tx = await factory.createAMM(
        token.address,
        testRateOracle.address,
        termEndTimestampBN
      );
      const receipt = await tx.wait();
      const ammAddress = receipt.events?.[0].args?.ammAddress as string;

      // check that AMM address is valid
      expect(ammAddress).to.not.equal(ZERO_ADDRESS);
    });
  });

  // describe("#createVAMM", () => {
  //     let factory: Factory;
  //     let token: ERC20Mock;
  //     let termStartTimestamp: number;
  //     let termEndTimestamp: number;
  //     let termEndTimestampBN: BigNumber;

  //     beforeEach("deploy fixture", async() => {
  //         ({ factory, token } = await loadFixture(metaFixture));
  //         termStartTimestamp = await getCurrentTimestamp(provider);
  //         termEndTimestamp = termStartTimestamp + consts.ONE_WEEK.toNumber();
  //         termEndTimestampBN = toBn(termEndTimestamp.toString());
  //     });

  //     it("checkOwnerPrivilege", async () => {
  //         await expect(factory.connect(other).createVAMM(ZERO_ADDRESS)).to.be.revertedWith("NOT_OWNER");
  //     });

  //     it("checkZeroAddress", async () => {
  //         await expect(factory.createVAMM(ZERO_ADDRESS)).to.be.revertedWith("ZERO_ADDRESS");
  //     });

  //     it("checkCreateVAMM", async () => {
  //         let tx_amm = await factory.createAMM(token.address, testRateOracle.address, termEndTimestampBN);
  //         let receipt_amm = await tx_amm.wait();
  //         const ammAddress = receipt_amm.events?.[0].args?.ammAddress as string;
  //         console.log("AMM address:", ammAddress);

  //         let tx_vamm = await factory.createVAMM(ammAddress);
  //         let receipt_vamm = await tx_vamm.wait();
  //         const vammAddress = receipt_vamm.events?.[0].args?.vammAddress as string;
  //         console.log("-> VAMM address:", vammAddress);

  //         expect(vammAddress).to.not.equal(ZERO_ADDRESS);

  //         // // check that VAMM is in map
  //         // expect(await factory.getVAMMMap(ammAddress)).to.equal(vammAddress);

  //         // // check that VAMM is not duplicated
  //         // await expect(factory.createVAMM(ammAddress)).to.be.revertedWith("EXISTED_VAMM");
  //     });
  // });

  // describe("#createMarginEngine", () => {
  //     let factory: Factory;
  //     let token: ERC20Mock;
  //     let termStartTimestamp: number;
  //     let termEndTimestamp: number;
  //     let termEndTimestampBN: BigNumber;

  //     beforeEach("deploy fixture", async() => {
  //         ({ factory, token } = await loadFixture(metaFixture));
  //         termStartTimestamp = await getCurrentTimestamp(provider);
  //         termEndTimestamp = termStartTimestamp + consts.ONE_WEEK.toNumber();
  //         termEndTimestampBN = toBn(termEndTimestamp.toString());
  //     });

  //     it("checkOwnerPrivilege", async () => {
  //         await expect(factory.connect(other).createMarginEngine(ZERO_ADDRESS)).to.be.revertedWith("NOT_OWNER");
  //     });

  //     it("checkZeroAddress", async () => {
  //         await expect(factory.createMarginEngine(ZERO_ADDRESS)).to.be.revertedWith("ZERO_ADDRESS");
  //     });

  //     it("checkcreateMarginEngine", async () => {
  //         let tx_amm = await factory.createAMM(token.address, testRateOracle.address, termEndTimestampBN);
  //         let receipt_amm = await tx_amm.wait();
  //         const ammAddress = receipt_amm.events?.[0].args?.ammAddress as string;
  //         console.log("AMM address:", ammAddress);

  //         let tx_me = await factory.createMarginEngine(ammAddress);
  //         let receipt_me = await tx_me.wait();
  //         const marginEngineAddress = receipt_me.events?.[0].args?.marginEngineAddress as string;
  //         console.log("-> Margin Engine address:", marginEngineAddress);

  //         expect(marginEngineAddress).to.not.equal(ZERO_ADDRESS);
  //     });
  // });

  describe("#addRateOracle", () => {
    let token: ERC20Mock;
    let aaveLendingPool: MockAaveLendingPool;

    beforeEach("deploy fixture", async () => {
      ({ token } = await loadFixture(metaFixture));
      ({ aaveLendingPool } = await mockAaveLendingPoolFixture());
      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        BigNumber.from(10).pow(27)
      );
    });
  });
});
