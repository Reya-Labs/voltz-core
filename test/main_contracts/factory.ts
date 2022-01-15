import { ethers, waffle } from "hardhat";
import { Wallet, utils } from "ethers";
import { Factory } from "../../typechain/Factory";
import { TestRateOracle } from "../../typechain/TestRateOracle";
import { ERC20Mock } from "../../typechain/ERC20Mock";
import { expect } from "../shared/expect";
<<<<<<< HEAD
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
=======
import { metaFixture } from "../shared/fixtures";
import { BigNumber } from "@ethersproject/bignumber";

>>>>>>> ammRefactoring
const createFixtureLoader = waffle.createFixtureLoader;

const salts = [utils.formatBytes32String("1"), utils.formatBytes32String("2")];

describe("Factory", () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof createFixtureLoader>;
  let factory: Factory;
  let token: ERC20Mock;
  let rateOracleTest: TestRateOracle;
  let termStartTimestampBN: BigNumber;
  let termEndTimestampBN: BigNumber;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
    ({
      factory,
      token,
      rateOracleTest,
      termStartTimestampBN,
      termEndTimestampBN,
    } = await loadFixture(metaFixture));
  });

<<<<<<< HEAD
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
=======
  // linter doesn't like these for some reason
  // it("Check master margin engine was successfully deployed", async () => {
  //   expect(marginEngineMasterTest.address).to.exist;
  // });

  // it("Check master vamm was successfully deployed", async () => {
  //   expect(vammMasterTest.address).to.exist;
  // });
>>>>>>> ammRefactoring

  // it("Check factory was successfully deployed", async () => {
  //   expect(factory.address).to.exist;
  // });

  it("Should deploy a cloned MarginEngine contract and allow initialisation of custom MarginEngine info", async () => {
    // get the expected address
    const marginEngineAddress = await factory.getMarginEngineAddress(salts[0]);
    // expect(marginEngineAddress).to.exist;

    await factory.createMarginEngine(salts[0]);

<<<<<<< HEAD
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
=======
    const marginEngineTestFactory = await ethers.getContractFactory(
      "TestMarginEngine"
    );
    const marginEngine1 = marginEngineTestFactory.attach(marginEngineAddress);

    expect(marginEngine1.address).to.eq(marginEngineAddress);

    await marginEngine1.initialize(
      token.address,
      rateOracleTest.address,
      termStartTimestampBN,
      termEndTimestampBN
    );
>>>>>>> ammRefactoring

    await expect(
      marginEngine1.initialize(
        token.address,
<<<<<<< HEAD
        testRateOracle.address,
=======
        rateOracleTest.address,
        termStartTimestampBN,
>>>>>>> ammRefactoring
        termEndTimestampBN
      )
    ).to.be.revertedWith("contract is already initialized");

    const underlyingAddress = await marginEngine1.underlyingToken();
    const rateOracleAddress = await marginEngine1.rateOracleAddress();
    const termStartTimestampBNERealised =
      await marginEngine1.termStartTimestamp();
    const termEndTimestampBNRealised = await marginEngine1.termEndTimestamp();
    expect(underlyingAddress).to.eq(token.address);
    expect(rateOracleAddress).to.eq(rateOracleTest.address);
    expect(termStartTimestampBNERealised).to.eq(termStartTimestampBN);
    expect(termEndTimestampBNRealised).to.eq(termEndTimestampBN);

    // deploy a vamm

    const vammAddress = await factory.getVAMMAddress(salts[1]);
    // expect(vammAddress).to.exist;

<<<<<<< HEAD
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
=======
    await factory.createVAMM(salts[1]);

    const vammTestFactory = await ethers.getContractFactory("TestVAMM");
    const vamm1 = vammTestFactory.attach(vammAddress);

    expect(vamm1.address).to.eq(vammAddress);

    await vamm1.initialize(marginEngine1.address);

    await expect(vamm1.initialize(marginEngine1.address)).to.be.revertedWith(
      "contract is already initialized"
    );

    const marginEngineAddressRealised = await vamm1.marginEngineAddress();
    expect(marginEngineAddressRealised).to.eq(marginEngine1.address);
>>>>>>> ammRefactoring
  });
});
