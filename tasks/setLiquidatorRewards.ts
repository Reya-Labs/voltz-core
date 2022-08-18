import "@nomiclabs/hardhat-ethers";
import { BigNumberish } from "ethers";

import { task } from "hardhat/config";
import mustache from "mustache";
import path from "path";
import { getPositions, Position } from "../scripts/getPositions";

interface MultisigTemplateData {
  rewards: {
    marginEngineAddress: string;
    liquidatorReward: BigNumberish;
  }[];
}

async function writeUpdateTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  // Get external template with fetch
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "setLiquidatorRewards.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `setLiquidatorRewards.json`;
  fs.writeFileSync(file, output);
}

task("setLiquidatorRewards", "Set liquidator rewards").setAction(async () => {
  const marginEngineAddresses = new Set<string>();
  const positions: Position[] = await getPositions();
  for (const position of positions) {
    // const marginEngine = (await hre.ethers.getContractAt(
    //   "MarginEngine",
    //   position.marginEngine
    // )) as MarginEngine;

    // const start = await marginEngine.termStartTimestampWad();
    // const end = await marginEngine.termEndTimestampWad();
    // if (start <= currentTimestampWad && currentTimestampWad <= end) {
    marginEngineAddresses.add(position.marginEngine);
    // }
  }

  const data: MultisigTemplateData = {
    rewards: [],
  };

  for (const marginEngineAddress of marginEngineAddresses) {
    const reward = {
      marginEngineAddress: marginEngineAddress,
      liquidatorReward: 0,
    };

    data.rewards.push(reward);
  }

  await writeUpdateTransactionsToGnosisSafeTemplate(data);
});
