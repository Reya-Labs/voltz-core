import { task } from "hardhat/config";
import { MarginEngine, VAMM } from "../typechain";
import positionsJson from "../playground/positions-ALL.json";
import { ethers } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const vammImplementation = "0x7380Df8AbB0c44617C2a64Bf2D7D92caA852F03f";

// rocket
const rocketPoolRateOracle = "0x6975B83ef331E65D146e4C64Fb45392cd2237a3c";
const rocketMarginEngine = "0xb1125ba5878cf3a843be686c6c2486306f03e301";

// lido
const lidoRateOracle = "0xA667502bF7f5dA45c7b6a70dA7f0595E6Cf342D8";
const lidoMarginEngine = "0x21f9151d6e06f834751b614c2ff40fc28811b235";

task("checkPositions", "Check positions").setAction(async (_, hre) => {
  const addSigner = async (address: string): Promise<SignerWithAddress> => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
    });
    await hre.network.provider.send("hardhat_setBalance", [
      address,
      "0x1000000000000000000",
    ]);
    return await hre.ethers.getSigner(address);
  };

  const removeSigner = async (address: string) => {
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [address],
    });
  };

  const withSigner = async (
    address: string,
    f: (_: SignerWithAddress) => Promise<void>
  ) => {
    const signer = await addSigner(address);
    await f(signer);
    await removeSigner(address);
  };

  const marginEngineAddress = lidoMarginEngine;
  const rateOracleAddress = lidoRateOracle;

  const marginEngine = (await hre.ethers.getContractAt(
    "MarginEngine",
    marginEngineAddress
  )) as MarginEngine;

  const fs = require("fs");
  const file = `${marginEngineAddress}.csv`;

  const header =
    "owner,lower_tick,upper_tick,position_margin,position_margin_before,position_requirement_before,position_margin_after,position_requirement_after";

  fs.appendFileSync(file, header + "\n");
  console.log(header);

  const blockNumberBefore = await hre.ethers.provider.getBlockNumber();

  await withSigner(await marginEngine.owner(), async (s) => {
    const vammAddress = await marginEngine.vamm();
    const vamm = (await hre.ethers.getContractAt("VAMM", vammAddress)) as VAMM;
    await vamm.connect(s).upgradeTo(vammImplementation);
    await marginEngine.connect(s).setRateOracle(rateOracleAddress);
    await vamm.connect(s).refreshRateOracle();
  });

  const blocksPerDay = 6570; // 13.15 seconds per block
  if (hre.network.name === "localhost") {
    for (let i = 0; i < blocksPerDay; i++) {
      await hre.network.provider.send("evm_mine", []);
    }
  }

  await marginEngine.getHistoricalApy();

  const blockNumberAfter = await hre.ethers.provider.getBlockNumber();

  for (const key in positionsJson.positions) {
    const position = positionsJson.positions[key];

    if (position.marginEngine === marginEngineAddress) {
      const positionRequirementBefore =
        await marginEngine.callStatic.getPositionMarginRequirement(
          position.owner,
          position.tickLower,
          position.tickUpper,
          true,
          {
            blockTag: blockNumberBefore,
          }
        );

      const positionRequirementAfter =
        await marginEngine.callStatic.getPositionMarginRequirement(
          position.owner,
          position.tickLower,
          position.tickUpper,
          true,
          {
            blockTag: blockNumberAfter,
          }
        );

      const positionInfoBefore = await marginEngine.callStatic.getPosition(
        position.owner,
        position.tickLower,
        position.tickUpper,
        {
          blockTag: blockNumberBefore,
        }
      );

      const positionInfoAfter = await marginEngine.callStatic.getPosition(
        position.owner,
        position.tickLower,
        position.tickUpper,
        {
          blockTag: blockNumberAfter,
        }
      );

      console.log(
        position.owner,
        position.tickLower,
        position.tickUpper,
        ethers.utils.formatEther(positionInfoBefore.margin),
        ethers.utils.formatEther(positionRequirementBefore),
        ethers.utils.formatEther(positionInfoAfter.margin),
        ethers.utils.formatEther(positionRequirementAfter)
      );
    }
  }
});

module.exports = {};
