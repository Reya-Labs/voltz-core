import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { Factory } from "../../typechain/Factory";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import { getCurrentTimestamp } from "../helpers/time";
import { toBn } from "evm-bn";
import { consts } from "../helpers/constants";
import { ERC20Mock, TestAMM } from "../../typechain";
import { RATE_ORACLE_ID } from "../shared/utilities";
const { provider } = waffle;

const createFixtureLoader = waffle.createFixtureLoader;

describe("AMM", () => {
  let wallet: Wallet, other: Wallet;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  describe("#setVAMM", () => {
    let factory: Factory;
    let token: ERC20Mock;
    let termStartTimestamp: number;
    let termEndTimestamp: number;
    let termEndTimestampBN: BigNumber;
    let ammTest: TestAMM;

    beforeEach("deploy fixture", async () => {
      ({ factory, token, ammTest } = await loadFixture(metaFixture));
      termStartTimestamp = await getCurrentTimestamp(provider);
      termEndTimestamp = termStartTimestamp + consts.ONE_WEEK.toNumber();
      termEndTimestampBN = toBn(termEndTimestamp.toString());
    });

    it("checkOwnerPrivilege", async () => {
      // create new AMM
      const tx = await factory.createAMM(
        token.address,
        RATE_ORACLE_ID,
        termEndTimestampBN
      );
      const receipt = await tx.wait();
      const ammAddress = receipt.events?.[0].args?.ammAddress as string;

      // TODO: create new VAMM

      // TODO: change AMM address -> VAMM address
      await expect(ammTest.connect(other).setVAMM(ammAddress)).to.be.reverted;
    });

    it("checkCreateAMM", async () => {
      // create new AMM
      const tx = await factory.createAMM(
        token.address,
        RATE_ORACLE_ID,
        termEndTimestampBN
      );
      const receipt = await tx.wait();
      const ammAddress = receipt.events?.[0].args?.ammAddress as string;

      // TODO: create new VAMM

      // TODO: change AMM address -> VAMM address
      ammTest.setVAMM(ammAddress);
    });
  });

  describe("#setMarginEngine", () => {
    let factory: Factory;
    let token: ERC20Mock;
    let termStartTimestamp: number;
    let termEndTimestamp: number;
    let termEndTimestampBN: BigNumber;
    let ammTest: TestAMM;

    beforeEach("deploy fixture", async () => {
      ({ factory, token, ammTest } = await loadFixture(metaFixture));
      termStartTimestamp = await getCurrentTimestamp(provider);
      termEndTimestamp = termStartTimestamp + consts.ONE_WEEK.toNumber();
      termEndTimestampBN = toBn(termEndTimestamp.toString());
    });

    it("checkOwnerPrivilege", async () => {
      // create new AMM
      const tx = await factory.createAMM(
        token.address,
        RATE_ORACLE_ID,
        termEndTimestampBN
      );
      const receipt = await tx.wait();
      const ammAddress = receipt.events?.[0].args?.ammAddress as string;

      // TODO: create new VAMM

      // TODO: change AMM address -> VAMM address
      await expect(ammTest.connect(other).setMarginEngine(ammAddress)).to.be
        .reverted;
    });

    it("checkCreateMarginEngine", async () => {
      // create new AMM
      const tx = await factory.createAMM(
        token.address,
        RATE_ORACLE_ID,
        termEndTimestampBN
      );
      const receipt = await tx.wait();
      const ammAddress = receipt.events?.[0].args?.ammAddress as string;

      // TODO: create new VAMM

      // TODO: change AMM address -> VAMM address
      ammTest.setMarginEngine(ammAddress);
    });
  });

  describe("#collectProtocol", () => {
    let ammTest: TestAMM;

    beforeEach("deploy fixture", async () => {
      ({ ammTest } = await loadFixture(metaFixture));
    });

    it("checkOwnerPrivilege", async () => {
      await expect(ammTest.connect(other).collectProtocol(other.address)).to.be
        .reverted;
    });

    it("checkCollectProtocol", async () => {
      await expect(ammTest.collectProtocol(other.address)).to.not.be.reverted;
    });
  });
});
