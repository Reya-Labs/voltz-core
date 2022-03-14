import { utils } from "ethers";
import { task } from "hardhat/config";
import { ERC20Mock } from "../typechain";
import { toBn } from "../test/helpers/toBn";

task(
  "mintTestTokens",
  "Mints tokens to a list of accounts for testing. Token must be publicly mintable."
)
  .addParam(
    "beneficiaries",
    "A comma-separated string of the addresses to which tokens should be minted"
  )
  .addOptionalParam(
    "tokenAddress",
    "The address of the token to mint (default: the mock token deployed by us)"
  )
  .addOptionalParam("amount", "The amount to mint to each beneficiary", "100")
  .setAction(async (taskArgs, hre) => {
    const amount = toBn(taskArgs.amount);

    const accounts = taskArgs.beneficiaries
      .split(",")
      .map((a: string) => utils.getAddress(a));

    let token: ERC20Mock;
    if (taskArgs.tokenAddress) {
      token = (await hre.ethers.getContractAt(
        "ERC20Mock",
        taskArgs.tokenAddress
      )) as ERC20Mock;
    } else {
      token = (await hre.ethers.getContract("ERC20Mock")) as ERC20Mock;
    }

    for (const a of accounts) {
      await token.mint(a, amount);
      console.log(
        `Minted ${amount.toString()} wei of token ${token.address} to ${a}`
      );
    }
  });

module.exports = {};
