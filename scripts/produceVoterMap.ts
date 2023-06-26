import fs from "fs";
import {
  parseBalanceMap,
  MerkleDistributorInfo,
} from "../deployConfig/parse-balance-map";

const json = JSON.parse(
  fs.readFileSync("deployConfig/nftSnapshot.json", { encoding: "utf8" })
);

let sum = 0;
for (const addr in json) {
  sum += json[addr];
}
console.log("Power sum", sum);

const merkleDistributorInfo: MerkleDistributorInfo = parseBalanceMap(json);

console.log("Merkle Root:", merkleDistributorInfo.merkleRoot);

const voters = merkleDistributorInfo.claims;

const votersJSON = JSON.stringify(voters);

fs.writeFile("scripts/voters.json", votersJSON, "utf8", (err) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log("File has been created");
});

// get claim for a particular address
const output =
  merkleDistributorInfo.claims["0xF8F6B70a36f4398f0853a311dC6699Aba8333Cc1"];

console.log("output for an address", output);
