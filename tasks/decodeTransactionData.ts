// import { utils } from "ethers";
import { ethers } from "ethers";
import { task } from "hardhat/config";
// import { toBn } from "../test/helpers/toBn";

task(
  "decodeTransactionData",
  "Decodes hex-encoded transaction data into a function name and parameters"
)
  .addParam(
    "data",
    "The transaction data as a hex string, including the function sighash in the first 4 bytes"
  )
  .setAction(async (taskArgs, hre) => {
    const contractTypes = ["Factory", "MarginEngine", "VAMM", "Periphery"];

    let result: ethers.utils.TransactionDescription | undefined;
    let contractType: string | undefined;

    for (const contractName of contractTypes) {
      const contract = await hre.ethers.getContract(contractName);
      const contractInterface = contract.interface;
      try {
        result = contractInterface.parseTransaction({ data: taskArgs.data });
        contractType = contractName;
      } catch (e) {
        // Presume no match - continue
        // console.log(`No match for contract ${contractName}`);
      }
    }

    if (contractType && result) {
      console.log(`${contractType}.${result.name}(
  ${result.args}
)`);
    } else {
      console.log(`No matching function found in contracts: ${contractTypes}`);
    }
  });

module.exports = {};
