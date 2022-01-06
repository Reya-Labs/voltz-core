import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { Factory } from "../../typechain/Factory";
import { expect } from "../shared/expect";
import {
  timeFixture,
  metaFixture,
  fixedAndVariableMathFixture,
  marginCalculatorFixture,
  rateOracleFixture,
  mockAaveLendingPoolFixture,
} from "../shared/fixtures";
import { getCurrentTimestamp } from "../helpers/time";
import { toBn } from "evm-bn";
import { consts } from "../helpers/constants";
import {
  ERC20Mock,
  FixedAndVariableMath,
  MockAaveLendingPool,
  TestRateOracle,
  Time,
} from "../../typechain";
import {
  RATE_ORACLE_ID,
  INVALID_ORACLE_ID,
  ZERO_ADDRESS,
  ZERO_BYTES,
} from "../shared/utilities";
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
      const { time } = await timeFixture();
      const { fixedAndVariableMath } = await fixedAndVariableMathFixture(
        time.address
      );

      const { testMarginCalculator } = await marginCalculatorFixture(
        fixedAndVariableMath.address,
        time.address,
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

    beforeEach("deploy fixture", async () => {
      ({ factory, token } = await loadFixture(metaFixture));
      termStartTimestamp = await getCurrentTimestamp(provider);
      termEndTimestamp = termStartTimestamp + consts.ONE_WEEK.toNumber();
      termEndTimestampBN = toBn(termEndTimestamp.toString());
    });

    it("checkOwnerPrivilege", async () => {
      await expect(
        factory
          .connect(other)
          .createAMM(token.address, RATE_ORACLE_ID, termEndTimestampBN)
      ).to.be.revertedWith("NOT_OWNER");
    });

    it("checkCreateAMM", async () => {
      // create AMM
      const tx = await factory.createAMM(
        token.address,
        RATE_ORACLE_ID,
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
  //         let tx_amm = await factory.createAMM(token.address, RATE_ORACLE_ID, termEndTimestampBN);
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
  //         let tx_amm = await factory.createAMM(token.address, RATE_ORACLE_ID, termEndTimestampBN);
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
    let factory: Factory;
    let fixedAndVariableMath: FixedAndVariableMath;
    let token: ERC20Mock;
    let time: Time;
    let aaveLendingPool: MockAaveLendingPool;
    let testRateOracle: TestRateOracle;

    beforeEach("deploy fixture", async () => {
      ({ time } = await loadFixture(timeFixture));
      ({ fixedAndVariableMath } = await fixedAndVariableMathFixture(
        time.address
      ));
      ({ factory, token } = await loadFixture(metaFixture));
      ({ aaveLendingPool } = await mockAaveLendingPoolFixture());
      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        BigNumber.from(10).pow(27)
      );

      ({ testRateOracle } = await rateOracleFixture(
        fixedAndVariableMath.address,
        time.address,
        token.address,
        aaveLendingPool.address,
        factory.address
      ));
    });

    it("checkOwnerPrivelege", async () => {
      await expect(
        factory
          .connect(other)
          .addRateOracle(RATE_ORACLE_ID, testRateOracle.address)
      ).to.be.revertedWith("NOT_OWNER");
    });

    it("checkZeroBytes", async () => {
      await expect(
        factory.addRateOracle(ZERO_BYTES, testRateOracle.address)
      ).to.be.revertedWith("ZERO_BYTES");
    });

    it("checkInvalidOracleID", async () => {
      await expect(
        factory.addRateOracle(INVALID_ORACLE_ID, testRateOracle.address)
      ).to.be.revertedWith("INVALID_ID");
    });

    it("checkExistedID", async () => {
      await expect(
        factory.addRateOracle(RATE_ORACLE_ID, testRateOracle.address)
      ).to.be.revertedWith("EXISTED_ID");
    });
  });
});
