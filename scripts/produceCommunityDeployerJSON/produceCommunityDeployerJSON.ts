import { task } from "hardhat/config";
import { getSeasonUsers } from "@voltz-protocol/subgraph-data";
import path from "path";

const fs = require("fs");

const snapshotTimeMS = 1675684800000; // Mon Feb 06 2023 12:00:00 GMT+0000

task("generateCommunityDeployerJSON", "Generates JSON for voting").setAction(
  async (targArgs, _) => {
    // eslint-disable-next-line no-unused-expressions
    targArgs;

    const votingPowerPerAddress: { [account: string]: number } = {};
    const seasonUsers = await getSeasonUsers(
      process.env.COMMUNITY_SUBGRAPH_URL || ""
    );
    for (const seasonUser of seasonUsers) {
      for (const badge of seasonUser.badges) {
        if (badge.mintedTimestampInMS > 0) {
          if (votingPowerPerAddress[seasonUser.owner] === undefined) {
            votingPowerPerAddress[seasonUser.owner] = 0;
          }
          if (badge.mintedTimestampInMS <= snapshotTimeMS) {
            votingPowerPerAddress[seasonUser.owner] += 1;
          }
        }
      }
    }

    // https://etherscan.io/token/0x8c7e68e7706842bfc70053c4ced21500488e73a8#balances
    const csvFilePath = path.resolve(__dirname, "genesisNFTSnapshot.csv");

    let fileContent = await fs.readFileSync(csvFilePath, {
      encoding: "utf-8",
    });
    fileContent = fileContent.split("\n");
    for (let i = 1; i < fileContent.length; i += 1) {
      fileContent[i] = fileContent[i].split('"').join("");

      const columns = fileContent[i].split(",");
      if (columns.length !== 3) {
        continue;
      }

      if (votingPowerPerAddress[columns[0]] === undefined) {
        votingPowerPerAddress[columns[0]] = 0;
      }
      votingPowerPerAddress[columns[0]] += parseInt(columns[1]);
    }

    const sortableArray = Object.entries(votingPowerPerAddress);
    const sortedArray = sortableArray.sort(([, a], [, b]) => b - a);
    const sortedVotingPowerPerAddress = Object.fromEntries(sortedArray);

    fs.writeFileSync(
      path.resolve(__dirname, "nftSnapshot.json"),
      JSON.stringify(sortedVotingPowerPerAddress, null, 2)
    );

    let votingPowerSum = 0;
    for (const address in votingPowerPerAddress) {
      votingPowerSum += votingPowerPerAddress[address];
    }

    console.log("Voting Power Sum: ", votingPowerSum);
  }
);
