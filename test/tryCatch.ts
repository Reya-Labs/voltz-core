// import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { TryCatch1 } from "../typechain/TryCatch1";
import { expect } from "./shared/expect";
// import { expect } from "../shared/expect";
// import snapshotGasCost from "../shared/snapshotGasCost";
// import {
//   encodePriceSqrt,
//   MIN_SQRT_RATIO,
//   MAX_SQRT_RATIO,
// } from "../shared/utilities";
// import Decimal from "decimal.js";

describe("TryCatch1", () => {
  let tryCatch: TryCatch1;

  before("deploy TryCatch1", async () => {
    const factory = await ethers.getContractFactory("TryCatch1");
    tryCatch = (await factory.deploy()) as TryCatch1;
  });

  describe("#test1", () => {
    it("throws and catches without error", async () => {
      await tryCatch.catcher();
    });

    it("returns correct value", async () => {
      const result = await tryCatch.callStatic.catcher();

      expect(result).to.eq(123);
    });
  });
});
