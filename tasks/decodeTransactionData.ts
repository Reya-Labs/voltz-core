import { utils, ethers } from "ethers";
import { task } from "hardhat/config";
const marginCalculatorParamNames = [
  "apyUpperMultiplierWad",
  "apyLowerMultiplierWad",
  "sigmaSquaredWad",
  "alphaWad",
  "betaWad",
  "xiUpperWad",
  "xiLowerWad",
  "tMaxWad",
  "devMulLeftUnwindLMWad",
  "devMulRightUnwindLMWad",
  "devMulLeftUnwindIMWad",
  "devMulRightUnwindIMWad",
  "fixedRateDeviationMinLeftUnwindLMWad",
  "fixedRateDeviationMinRightUnwindLMWad",
  "fixedRateDeviationMinLeftUnwindIMWad",
  "fixedRateDeviationMinRightUnwindIMWad",
  "gammaWad",
  "minMarginToIncentiviseLiquidators",
];

function printMarginCalculatorParams(td: ethers.utils.TransactionDescription) {
  const mcp = td.args[0];
  console.log(JSON.stringify(td.args, null, 2));
  console.log(`MarginEngine.setMarginCalculatorParameters(`);

  for (let i = 0; i < marginCalculatorParamNames.length; i++) {
    console.log(
      `  ${mcp[i].toString().padStart(27)}, // ${utils
        .formatUnits(mcp[i])
        .toString()
        .padStart(10)} ${marginCalculatorParamNames[i]}`
    );
  }
  console.log(`)`);
}

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
      if (result.name === "setMarginCalculatorParameters") {
        printMarginCalculatorParams(result);
      } else {
        console.log(
          `${contractType}.${result.name}(
  ${result.args}
)`
        );
      }
    } else {
      console.log(`No matching function found in contracts: ${contractTypes}`);
    }
  });

module.exports = {};
