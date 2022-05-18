

import fs from "fs";
import { parseBalanceMap, MerkleDistributorInfo } from "../deployConfig/parse-balance-map";


const json = JSON.parse(
    fs.readFileSync("deployConfig/nftSnapshot.json", { encoding: "utf8" })
  );

const merkleDistributorInfo: MerkleDistributorInfo = parseBalanceMap(json);

const voters = merkleDistributorInfo.claims;

const votersJSON = JSON.stringify(voters);

fs.writeFile('scripts/voters.json', votersJSON, 'utf8', (err) => {
    if (err) {  console.error(err);  return; };
    console.log("File has been created");
});

// get claim for a particular address
// const output = claims['0x067232D22d5bb8DC7cDaBa5A909ac8b089539462'];

// console.log("output for an address", output);