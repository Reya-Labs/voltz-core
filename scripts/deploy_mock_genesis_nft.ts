import { ethers } from "hardhat";
import { MockGenesisNFT } from "../typechain";

async function main() {

  const mockGenesisNFTFactory = await ethers.getContractFactory("MockGenesisNFT");
  console.log("deploying mock genesis nft");
  const mockGenesisNFT = await mockGenesisNFTFactory.deploy() as MockGenesisNFT;
  
  await mockGenesisNFT.deployed();
  console.log("Mock Genesis NFT deployed to:", mockGenesisNFT.address);

  // mint
  await mockGenesisNFT.mint(1); // tokenId is 1
  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});