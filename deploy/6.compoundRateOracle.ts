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
    for (const cTokenDefinition of compoundTokens) {
      const rateOracleIdentifier = `CompoundRateOracle_${cTokenDefinition.name}`;
      let rateOracleContract = (await ethers.getContractOrNull(
        rateOracleIdentifier
      )) as CompoundRateOracle;

      if (!rateOracleContract) {
        // There is no Compound rate oracle already deployed for this token. Deploy one now.
        // But first, do a sanity check
        const cToken = await ethers.getContractAt(
          "ICToken",
          cTokenDefinition.address
        );
        const underlying = await cToken.underlying();
        const exchangeRate = await cToken.exchangeRateStored();

        if (!exchangeRate) {
          throw Error(
            `Could not find data for token ${cTokenDefinition.name} (${cTokenDefinition.address})`
          );
        } else {
          const decimals = await underlying.decimals();

          await deploy(rateOracleIdentifier, {
            contract: "CompoundRateOracle",
            from: deployer,
            args: [cToken.address, underlying.address, decimals],
            log: doLogging,
          });
          console.log(
            `Deploy compound rate oracle for: {${cToken.address}, ${underlying.address}, ${decimals}}`
          );

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
        cTokenDefinition.rateOracleBufferSize
      );
      await checkMinSecondsSinceLastUpdate(
        rateOracleContract as CompoundRateOracle,
        cTokenDefinition.minSecondsSinceLastUpdate
      );
    }
  }

  // Deploy rate oracle pointing at mocks, if mocks exist
  const mockToken = await ethers.getContractOrNull("ERC20Mock");
  const mockCToken = await ethers.getContractOrNull("MockCToken");
  if (mockToken && mockCToken) {
    const decimals = await mockToken.decimals();
    console.log(
      `Deploy compound rate oracle for mocks: {${mockToken.address}, ${mockCToken.address}, ${decimals}}`
    );

    await deploy("TestCompoundRateOracle", {
      from: deployer,
      args: [mockCToken.address, mockToken.address, decimals],
      log: doLogging,
    });
  }
};
func.tags = ["CompoundRateOracles"];
export default func;
