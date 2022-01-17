import { Factory } from "../../typechain/Factory";
import { TestVAMM } from "../../typechain/TestVAMM";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { BigNumber } from "@ethersproject/bignumber";
import { TestRateOracle } from "../../typechain/TestRateOracle";

import { ERC20Mock, MockAaveLendingPool } from "../../typechain";

import { consts } from "../helpers/constants";

import { ethers, waffle } from "hardhat";
import { getCurrentTimestamp } from "../helpers/time";

import { toBn } from "evm-bn";
const { provider } = waffle;

export async function mockERC20Fixture() {
  const MockERC20Factory = await ethers.getContractFactory("ERC20Mock");

  const token = await MockERC20Factory.deploy("Voltz USD", "VUSD", 6);

  return { token };
}

export async function mockAaveLendingPoolFixture() {
  const MockAaveLendingPoolFactory = await ethers.getContractFactory(
    "MockAaveLendingPool"
  );

  const aaveLendingPool = await MockAaveLendingPoolFactory.deploy();

  return { aaveLendingPool };
}

export async function vammMasterTestFixture() {
  const vammMasterTestFactory = await ethers.getContractFactory("TestVAMM");
  const vammMasterTest = await vammMasterTestFactory.deploy();

  return { vammMasterTest };
}

export async function marginEngineMasterTestFixture() {
  const marginEngineMasterTestFactory = await ethers.getContractFactory(
    "TestMarginEngine"
  );
  const marginEngineMasterTest = await marginEngineMasterTestFactory.deploy();

  return { marginEngineMasterTest };
}

export async function factoryFixture(
  _masterMarginEngineAddress: string,
  _masterVAMMAddress: string
) {
  const factoryFactory = await ethers.getContractFactory("Factory");
  const factory = await factoryFactory.deploy(
    _masterMarginEngineAddress,
    _masterVAMMAddress
  );

  return { factory };
}

export async function rateOracleTestFixture(
  _aaveLendingPoolAddress: string,
  _underlyingAddress: string
) {
  const rateOracleTestFactory = await ethers.getContractFactory(
    "TestRateOracle"
  );
  const rateOracleTest = await rateOracleTestFactory.deploy(
    _aaveLendingPoolAddress,
    _underlyingAddress
  );

  return { rateOracleTest };
}

interface MetaFixture {
  factory: Factory;
  vammMasterTest: TestVAMM;
  marginEngineMasterTest: TestMarginEngine;
  token: ERC20Mock;
  rateOracleTest: TestRateOracle;
  aaveLendingPool: MockAaveLendingPool;
  termStartTimestampBN: BigNumber;
  termEndTimestampBN: BigNumber;
}

export const metaFixture = async function (): Promise<MetaFixture> {
  const { marginEngineMasterTest } = await marginEngineMasterTestFixture();
  const { vammMasterTest } = await vammMasterTestFixture();
  const { factory } = await factoryFixture(
    marginEngineMasterTest.address,
    vammMasterTest.address
  );
  const { token } = await mockERC20Fixture();
  const { aaveLendingPool } = await mockAaveLendingPoolFixture();
  const { rateOracleTest } = await rateOracleTestFixture(
    aaveLendingPool.address,
    token.address
  );

  const termStartTimestamp: number = await getCurrentTimestamp(provider);
  const termEndTimestamp: number =
    termStartTimestamp + consts.ONE_WEEK.toNumber();
  const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
  const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

  return {
    factory,
    vammMasterTest,
    marginEngineMasterTest,
    token,
    rateOracleTest,
    aaveLendingPool,
    termStartTimestampBN,
    termEndTimestampBN,
  };
};
