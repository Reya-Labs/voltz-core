import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  parseBalanceMap,
  MerkleDistributorInfo,
} from "../deployConfig/parse-balance-map";
import fs from "fs";

const QUORUM_VOTES = 2949;
const BLOCK_TIMESTAMP_VOTING_END = 1691755200; // Fri Aug 11 2023 12:00:00 GMT+0000

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  try {
    const { deploy } = hre.deployments;
    const { deployer } = await hre.getNamedAccounts();
    const doLogging = true;

    const json = JSON.parse(
      fs.readFileSync("deployConfig/nftSnapshot.json", { encoding: "utf8" })
    );
    const merkleDistributorInfo: MerkleDistributorInfo = parseBalanceMap(json);

    console.log("Total Genesis NFT count", merkleDistributorInfo.tokenTotal);
    console.log("Merkle Root", merkleDistributorInfo.merkleRoot);

    const communityVoter = await deploy("CommunityVoter", {
      from: deployer,
      log: doLogging,
      args: [
        QUORUM_VOTES,
        merkleDistributorInfo.merkleRoot,
        BLOCK_TIMESTAMP_VOTING_END,
      ],
    });

    console.log("Community Voted Address: ", communityVoter.address);

    return true; // Only execute once
  } catch (e) {
    console.error(e);
    throw e;
  }
};
func.tags = ["CommunityVoter"];
func.id = "CommunityVoter";
export default func;
