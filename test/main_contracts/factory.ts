import { ethers, waffle } from "hardhat";
import { Wallet } from "ethers";
import { Factory } from "../../typechain/Factory";
import { TestRateOracle } from "../../typechain/TestRateOracle";
import { ERC20Mock } from "../../typechain/ERC20Mock";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import { BigNumber } from "@ethersproject/bignumber";
import { TestMarginEngine, TestVAMM } from "../../typechain";
import { TICK_SPACING } from "../shared/utilities";

const createFixtureLoader = waffle.createFixtureLoader;

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

    // change the term start timestamp to deploy a different instance from the one we have in the meta fixture
    termStartTimestampBN = termEndTimestampBN.add(1);
  });

  it("Cannot deploy if not the owner", async () => {
    await expect(
      factory
        .connect(other)
        .deployIrsInstance(
          token.address,
          rateOracleTest.address,
          termStartTimestampBN,
          termEndTimestampBN,
          TICK_SPACING
        )
    ).to.be.revertedWith("caller is not the owner");
  });

  it("Deploys and initializes proxies successfully", async () => {
    // get the expected addresses
    const marginEngineAddress = await factory.getMarginEngineAddress(
      token.address,
      rateOracleTest.address,
      termStartTimestampBN,
      termEndTimestampBN,
      TICK_SPACING
    );
    const vammAddress = await factory.getVAMMAddress(
      token.address,
      rateOracleTest.address,
      termStartTimestampBN,
      termEndTimestampBN,
      TICK_SPACING
    );

    const fcmAddress = await factory.getFCMAddress(
      token.address,
      rateOracleTest.address,
      termStartTimestampBN,
      termEndTimestampBN,
      TICK_SPACING
    );

    // Now deployand check the log
    await expect(
      factory.deployIrsInstance(
        token.address,
        rateOracleTest.address,
        termStartTimestampBN,
        termEndTimestampBN,
        TICK_SPACING
      )
    )
      .to.emit(factory, "IrsInstanceDeployed")
      .withArgs(
        token.address,
        rateOracleTest.address,
        termStartTimestampBN,
        termEndTimestampBN,
        TICK_SPACING,
        marginEngineAddress,
        vammAddress,
        fcmAddress,
        1
      );

    const marginEngineTestFactory = await ethers.getContractFactory(
      "TestMarginEngine"
    );
    const marginEngine1 = marginEngineTestFactory.attach(
      marginEngineAddress
    ) as TestMarginEngine;

    expect(marginEngine1.address).to.eq(marginEngineAddress);

    await expect(
      marginEngine1.initialize(
        token.address,
        rateOracleTest.address,
        termStartTimestampBN,
        termEndTimestampBN
      )
    ).to.be.revertedWith("contract is already initialized");

    const underlyingAddress = await marginEngine1.underlyingToken();
    const rateOracleAddress = await marginEngine1.rateOracle();
    const termStartTimestampBNERealised =
      await marginEngine1.termStartTimestampWad();
    const termEndTimestampBNRealised =
      await marginEngine1.termEndTimestampWad();
    expect(underlyingAddress).to.eq(token.address);
    expect(rateOracleAddress).to.eq(rateOracleTest.address);
    expect(termStartTimestampBNERealised).to.eq(termStartTimestampBN);
    expect(termEndTimestampBNRealised).to.eq(termEndTimestampBN);

    // check vamm values
    const vammTestFactory = await ethers.getContractFactory("TestVAMM");
    const vamm1 = vammTestFactory.attach(vammAddress) as TestVAMM;

    expect(vamm1.address).to.eq(vammAddress);

    await expect(
      vamm1.initialize(marginEngine1.address, TICK_SPACING)
    ).to.be.revertedWith("contract is already initialized");

    const marginEngineAddressRealised = await vamm1.marginEngine();
    expect(marginEngineAddressRealised).to.eq(marginEngine1.address);
  });
});
