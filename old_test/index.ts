import { Wallet } from "ethers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Factory } from "../typechain/Factory";

import {
  FeeAmount,
  getCreate2Address,
  TICK_SPACINGS,
} from "./shared/utilities";

const createFixtureLoader = waffle.createFixtureLoader;

const TEST_ADDRESSES: [string, string] = [
  "0x1000000000000000000000000000000000000000",
  "0x2000000000000000000000000000000000000000",
];

describe("Factory", () => {
  let wallet: Wallet, other: Wallet;

  let factory: Factory;
  let poolBytecode: string;

  const fixture = async () => {
    const factoryFactory = await ethers.getContractFactory("Factory");
    return (await factoryFactory.deploy()) as Factory;
  };

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet, other]);
  });

  before("load pool bytecode", async () => {
    poolBytecode = (await ethers.getContractFactory("AMM")).bytecode; // todo: what is the purpose of the pool bytecode?
  });

  beforeEach("deploy factory", async () => {
    factory = await loadFixture(fixture);
  });

  it("owner is deployer", async () => {
    expect(await factory.owner()).to.eq(wallet.address);
  });

  it("initial enabled fee amounts", async () => {
    expect(await factory.feeAmountTickSpacing(FeeAmount.LOW)).to.eq(
      TICK_SPACINGS[FeeAmount.LOW]
    );
    expect(await factory.feeAmountTickSpacing(FeeAmount.MEDIUM)).to.eq(
      TICK_SPACINGS[FeeAmount.MEDIUM]
    );
    expect(await factory.feeAmountTickSpacing(FeeAmount.HIGH)).to.eq(
      TICK_SPACINGS[FeeAmount.HIGH]
    );
  });

  async function createAndCheckAMM(
    underlyingToken: string,
    underlyingPool: string,
    termEndTimestamp: number,
    termStartTimestamp: number,
    feeAmount: FeeAmount,
    tickSpacing: number = TICK_SPACINGS[feeAmount]
  ) {
    const create = await factory.createAMM(
      underlyingToken,
      underlyingPool,
      termEndTimestamp,
      termStartTimestamp,
      feeAmount
    );

    const ammAddress = await factory.getAMMMAp(
      underlyingPool,
      termEndTimestamp,
      termStartTimestamp,
      feeAmount
    );

    const ammContractFactory = await ethers.getContractFactory("AMM");
    const amm = ammContractFactory.attach(ammAddress); // todo: what exactly does attach achieve?

    expect(await amm.factory(), "amm factory address").to.eq(factory.address);
    expect(await amm.fee(), "amm fee").to.eq(feeAmount);
    expect(await amm.tickSpacing(), "amm tick spacing").to.eq(tickSpacing);
  }

  describe("#createAMM", () => {
    it("succeeds for low fee pool", async () => {
      await createAndCheckAMM(
        TEST_ADDRESSES[0],
        TEST_ADDRESSES[1],
        30,
        1634573378,
        FeeAmount.LOW
      );
    });
  });

  describe("#setOwner", () => {
    it("fails if caller is not owner", async () => {
      await expect(factory.connect(other).setOwner(wallet.address)).to.be
        .reverted;
    });

    it("updates owner", async () => {
      await factory.setOwner(other.address);
      expect(await factory.owner()).to.eq(other.address);
    });

    it("emits event", async () => {
      await expect(factory.setOwner(other.address))
        .to.emit(factory, "OwnerChanged")
        .withArgs(wallet.address, other.address);
    });

    it("cannot be called by original owner", async () => {
      await factory.setOwner(other.address);
      await expect(factory.setOwner(wallet.address)).to.be.reverted;
    });
  });

  describe("#enableFeeAmount", () => {
    it("fails if caller is not owner", async () => {
      await expect(factory.connect(other).enableFeeAmount(100, 2)).to.be
        .reverted;
    });

    it("fails if fee is too great", async () => {
      await expect(factory.enableFeeAmount(1000000, 10)).to.be.reverted;
    });

    it("fails if tick spacing is too small", async () => {
      await expect(factory.enableFeeAmount(500, 0)).to.be.reverted;
    });

    it("fails if tick spacing is too large", async () => {
      await expect(factory.enableFeeAmount(500, 16834)).to.be.reverted;
    });
    it("fails if already initialized", async () => {
      await factory.enableFeeAmount(100, 5);
      await expect(factory.enableFeeAmount(100, 10)).to.be.reverted;
    });
    it("sets the fee amount in the mapping", async () => {
      await factory.enableFeeAmount(100, 5);
      expect(await factory.feeAmountTickSpacing(100)).to.eq(5);
    });
    it("emits an event", async () => {
      await expect(factory.enableFeeAmount(100, 5))
        .to.emit(factory, "FeeAmountEnabled")
        .withArgs(100, 5);
    });
  });
});
