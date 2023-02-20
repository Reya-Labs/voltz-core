import { task } from "hardhat/config";
import { MarginEngine, Periphery } from "../typechain";

import { getPositions, Position } from "../scripts/getPositions";
import { HardhatRuntimeEnvironment } from "hardhat/types";

async function impersonateAccount(
  hre: HardhatRuntimeEnvironment,
  acctAddress: string
) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [acctAddress],
  });
}

async function getSigner(hre: HardhatRuntimeEnvironment, acctAddress: string) {
  if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
    await impersonateAccount(hre, acctAddress);
  }
  return await hre.ethers.getSigner(acctAddress);
}

task("checkWithdrawal", "Checks withdrawal of user").setAction(
  async (_, hre) => {
    const accountAddress = "0x7626fbA64DEB1683a364c32F30370215f05C1F09";
    const positions: Position[] = await getPositions();

    const periphery = (await hre.ethers.getContractAt(
      "Periphery",
      "0x07ced903e6ad0278cc32bc83a3fc97112f763722"
    )) as Periphery;

    for (const position of positions) {
      if (position.owner === accountAddress.toLowerCase()) {
        const marginEngine = (await hre.ethers.getContractAt(
          "MarginEngine",
          position.marginEngine
        )) as MarginEngine;

        const positionRequirementSafety =
          await marginEngine.callStatic.getPositionMarginRequirement(
            position.owner,
            position.tickLower,
            position.tickUpper,
            false
          );

        const positionRequirementLiquidation =
          await marginEngine.callStatic.getPositionMarginRequirement(
            position.owner,
            position.tickLower,
            position.tickUpper,
            true
          );

        const positionInfo = await marginEngine.callStatic.getPosition(
          position.owner,
          position.tickLower,
          position.tickUpper
        );

        let status = "HEALTHY";
        if (positionInfo.margin.lte(positionRequirementLiquidation)) {
          status = "DANGER";
        } else if (positionInfo.margin.lte(positionRequirementSafety)) {
          status = "WARNING";
        }

        console.log(
          position.owner,
          position.tickLower,
          position.tickUpper,
          hre.ethers.utils.formatEther(positionInfo.margin),
          hre.ethers.utils.formatEther(positionRequirementLiquidation),
          hre.ethers.utils.formatEther(positionRequirementSafety),
          status
        );

        await periphery
          .connect(await getSigner(hre, accountAddress))
          .updatePositionMargin(
            marginEngine.address,
            position.tickLower,
            position.tickUpper,
            positionInfo.margin.sub(positionRequirementSafety).sub(1).mul(-1),
            false
          )
          .then(async (result) => {
            console.log(result);

            const positionInfo_after =
              await marginEngine.callStatic.getPosition(
                position.owner,
                position.tickLower,
                position.tickUpper
              );

            console.log(
              hre.ethers.utils.formatEther(positionInfo_after.margin)
            );
          })
          .catch((error) => {
            console.log(error);
          });
      }
    }
  }
);

module.exports = {};
