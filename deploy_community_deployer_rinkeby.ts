import { ethers } from "hardhat";

async function main() {

  const communityDeployerFactory = await ethers.getContractFactory("CommunityDeployer");
  const communityDeployer = await communityDeployerFactory.deploy(); 
  await communityDeployer.deployed();
  
  console.log("Community Deployer deployed to:", registry.address);
  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});