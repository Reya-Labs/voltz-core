import { ethers, waffle } from "hardhat";
import { Wallet, utils } from "ethers";
import { Factory } from "../../typechain/Factory";
import { TestRateOracle } from "../../typechain/TestRateOracle";
import { ERC20Mock } from "../../typechain/ERC20Mock";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import { BigNumber } from "@ethersproject/bignumber";

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

  // linter doesn't like these for some reason
  // it("Check master margin engine was successfully deployed", async () => {
  //   expect(marginEngineMasterTest.address).to.exist;
  // });

  // it("Check master vamm was successfully deployed", async () => {
  //   expect(vammMasterTest.address).to.exist;
  // });

  // it("Check factory was successfully deployed", async () => {
  //   expect(factory.address).to.exist;
  // });

  it("Should deploy a cloned MarginEngine contract and allow initialisation of custom MarginEngine info", async () => {
    // get the expected address
    const marginEngineAddress = await factory.getMarginEngineAddress(salts[0]);
    // expect(marginEngineAddress).to.exist;

    await factory.createMarginEngine(salts[0]);

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

    await expect(
      marginEngine1.initialize(
        token.address,
        rateOracleTest.address,
        termStartTimestampBN,
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
  });
});
