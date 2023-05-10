import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  parseBalanceMap,
  MerkleDistributorInfo,
} from "../deployConfig/parse-balance-map";
import fs from "fs";

const QUORUM_VOTES = 1669;
const MULTISIG_ADDRESS = "0x7D48F1AC18E3b60387271535E29258da26C02030";
const BLOCK_TIMESTAMP_VOTING_END = 1684065600; // Sun May 14 2023 12:00:00 GMT+0000

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  try {
    const { deploy } = hre.deployments;
    const { deployer } = await hre.getNamedAccounts();
    const doLogging = true;

    // Factory, and master contracts that get cloned for each IRS instance
    const masterMarginEngineDeploy = await deploy("MarginEngine", {
      from: deployer,
      log: doLogging,
    });
    const masterVammDeploy = await deploy("VAMM", {
      from: deployer,
      log: doLogging,
    });

    const json = JSON.parse(
      fs.readFileSync("deployConfig/nftSnapshot.json", { encoding: "utf8" })
    );
    const merkleDistributorInfo: MerkleDistributorInfo = parseBalanceMap(json);

    console.log("Total Genesis NFT count", merkleDistributorInfo.tokenTotal);
    console.log("Merkle Root", merkleDistributorInfo.merkleRoot);

    const communityDeployer = await deploy("CommunityDeployer", {
      from: deployer,
      log: doLogging,
      args: [
        masterVammDeploy.address,
        masterMarginEngineDeploy.address,
        QUORUM_VOTES,
        MULTISIG_ADDRESS,
        merkleDistributorInfo.merkleRoot,
        BLOCK_TIMESTAMP_VOTING_END,
      ],
    });

    console.log("Community Deployer Address: ", communityDeployer.address);

    return true; // Only execute once
  } catch (e) {
    console.error(e);
    throw e;
  }
};
func.tags = ["CommunityDeployer"];
func.id = "CommunityDeployer";
export default func;
