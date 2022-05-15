import { ethers } from "hardhat";

async function main() {

  const mockGenesisNFTFactory = await ethers.getContractFactory("MockGenesisNFT");
  console.log("deploying mock genesis nft");
  const mockGenesisNFT = await mockGenesisNFTFactory.deploy();
  
  await mockGenesisNFT.deployed();
  console.log("Mock Genesis NFT deployed to:", mockGenesisNFT.address);
  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});