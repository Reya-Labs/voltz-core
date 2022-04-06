import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getCompoundTokens } from "../deployConfig/config";
import { CompoundRateOracle } from "../typechain/CompoundRateOracle";

const checkBufferSize = async (r: CompoundRateOracle, minSize: number) => {
  const currentSize = (await r.oracleVars())[2];
  // console.log(`currentSize of ${r.address} is ${currentSize}`);

  if (currentSize < minSize) {
    await r.increaseObservationCardinalityNext(minSize);
    console.log(`Increased size of ${r.address}'s buffer to ${minSize}`);
  }
};

const checkMinSecondsSinceLastUpdate = async (
  r: CompoundRateOracle,
  minSeconds: number
) => {
  const currentVal = (await r.minSecondsSinceLastUpdate()).toNumber();
  // console.log( `current minSecondsSinceLastUpdate of ${r.address} is ${currentVal}` );

  if (currentVal !== minSeconds) {
    await r.setMinSecondsSinceLastUpdate(minSeconds);
    console.log(
      `Updated minSecondsSinceLastUpdate of ${r.address} to ${minSeconds}`
    );
  }
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;

  const compoundTokens = getCompoundTokens(hre.network.name);

  if (compoundTokens) {
    for (const token of compoundTokens) {
      const rateOracleIdentifier = `CompoundRateOracle_${token.name}`;
      let rateOracleContract = (await ethers.getContractOrNull(
        rateOracleIdentifier
      )) as CompoundRateOracle;

      if (!rateOracleContract) {
        // There is no Compound rate oracle already deployed for this token. Deploy one now.
        // But first, do a sanity check
        const cToken = await ethers.getContractAt("ICToken", token.address);
        const exchangeRate = await cToken.exchangeRateStored();

        if (!exchangeRate) {
          throw Error(
            `Could not find data for token ${token.name} (${token.address})`
          );
        } else {
          await deploy(rateOracleIdentifier, {
            contract: "CompoundRateOracle",
            from: deployer,
            args: [cToken.address, token.address],
            log: doLogging,
          });
          console.log(`Created ${token.name} (${token.address}) rate oracle`);

          rateOracleContract = (await ethers.getContract(
            rateOracleIdentifier
          )) as CompoundRateOracle;

          // Check the buffer size and increase if required
          await rateOracleContract.writeOracleEntry();
        }
      }

      // Ensure the buffer is big enough
      await checkBufferSize(
        rateOracleContract as CompoundRateOracle,
        token.rateOracleBufferSize
      );
      await checkMinSecondsSinceLastUpdate(
        rateOracleContract as CompoundRateOracle,
        token.minSecondsSinceLastUpdate
      );
    }
  }

  // Deploy rate oracle pointing at mocks, if mocks exist
  const mockToken = await ethers.getContractOrNull("ERC20Mock");
  const mockCToken = await ethers.getContractOrNull("MockCToken");
  if (mockToken && mockCToken) {
    console.log(
      `Deploy rate oracle for mocked {token, cToken}: {${mockToken.address}, ${mockCToken.address}}`
    );
    await deploy("TestCompoundRateOracle", {
      from: deployer,
      args: [mockCToken.address, mockToken.address],
      log: doLogging,
    });
  }
};
func.tags = ["CompoundRateOracles"];
export default func;
