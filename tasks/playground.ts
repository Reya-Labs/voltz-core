import { task, types } from "hardhat/config";
import { MarginEngine, Periphery, VAMM } from "../typechain";
import { BigNumber, ethers } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import positionsJson from "../playground/positions-ALL.json";
import { poolConfigs } from "../deployConfig/poolConfig";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const vammImplementation = "0x7380Df8AbB0c44617C2a64Bf2D7D92caA852F03f";

// rocket
// eslint-disable-next-line no-unused-vars
const rocketPoolRateOracle = "0x41EcaAC9061F6BABf2D42068F8F8dAF3BA9644FF";
// eslint-disable-next-line no-unused-vars
const rocketMarginEngine = "0xb1125ba5878cf3a843be686c6c2486306f03e301";

// lido
// eslint-disable-next-line no-unused-vars
const lidoRateOracle = "0xA667502bF7f5dA45c7b6a70dA7f0595E6Cf342D8";
// eslint-disable-next-line no-unused-vars
const lidoMarginEngine = "0x21f9151d6e06f834751b614c2ff40fc28811b235";

task("rateOracleSwap", "Swap Rate Oracle").setAction(async (_, hre) => {
  if (!(hre.network.name === "localhost")) {
    throw new Error("Only localhost");
  }

  const addSigner = async (address: string): Promise<SignerWithAddress> => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
    });
    await hre.network.provider.send("hardhat_setBalance", [
      address,
      "0x1000000000000000000",
    ]);
    return await hre.ethers.getSigner(address);
  };

  const removeSigner = async (address: string) => {
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [address],
    });
  };

  const withSigner = async (
    address: string,
    f: (_: SignerWithAddress) => Promise<void>
  ) => {
    const signer = await addSigner(address);
    await f(signer);
    await removeSigner(address);
  };

  const marginEngineAddress = rocketMarginEngine;
  const rateOracleAddress = rocketPoolRateOracle;

  const marginEngine = (await hre.ethers.getContractAt(
    "MarginEngine",
    marginEngineAddress
  )) as MarginEngine;

  {
    const lookBackWindowAPY = await marginEngine.lookbackWindowInSeconds();
    const historicalAPY = await marginEngine.getHistoricalApyReadOnly();
    console.log(
      `lookBackWindowAPY: ${lookBackWindowAPY.toString()}, APY: ${ethers.utils.parseEther(
        historicalAPY.toString()
      )}`
    );
  }

  await withSigner(await marginEngine.owner(), async (s) => {
    const vammAddress = await marginEngine.vamm();
    const vamm = (await hre.ethers.getContractAt("VAMM", vammAddress)) as VAMM;
    console.log("upgrading vamm...");
    await vamm.connect(s).upgradeTo(vammImplementation);
    console.log("setting new rate oracle in margin engine...");
    await marginEngine.connect(s).setRateOracle(rateOracleAddress);
    console.log("setting new rate oracle in vamm...");
    await vamm.connect(s).refreshRateOracle();

    console.log("setting new lookback window in margin engine...");

    // const lookBackWindowAPY = await marginEngine.lookbackWindowInSeconds();
    await marginEngine
      .connect(s)
      .setLookbackWindowInSeconds(BigNumber.from(36 * 86400));
  });

  {
    const lookBackWindowAPY = await marginEngine.lookbackWindowInSeconds();
    const historicalAPY = await marginEngine.getHistoricalApyReadOnly();
    console.log(
      `lookBackWindowAPY: ${lookBackWindowAPY.toString()}, APY: ${ethers.utils.parseEther(
        historicalAPY.toString()
      )}`
    );
  }
});

task("mcParametersSwap", "Change margin calculator parameters").setAction(
  async (_, hre) => {
    const addSigner = async (address: string): Promise<SignerWithAddress> => {
      if (!(hre.network.name === "localhost")) {
        throw new Error("Only localhost");
      }
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [address],
      });
      await hre.network.provider.send("hardhat_setBalance", [
        address,
        "0x1000000000000000000",
      ]);
      return await hre.ethers.getSigner(address);
    };

    const removeSigner = async (address: string) => {
      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [address],
      });
    };

    const withSigner = async (
      address: string,
      f: (_: SignerWithAddress) => Promise<void>
    ) => {
      const signer = await addSigner(address);
      await f(signer);
      await removeSigner(address);
    };

    const marginEngineAddress = lidoMarginEngine;
    const mcParams = poolConfigs.new_stETH;

    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      marginEngineAddress
    )) as MarginEngine;

    await withSigner(await marginEngine.owner(), async (s) => {
      await marginEngine
        .connect(s)
        .setMarginCalculatorParameters(mcParams.marginCalculatorParams);
    });
  }
);

task("quickUpgrade", "Upgrades contract").setAction(async (taskArgs, hre) => {
  const _ERC1967_IMPLEMENTATION_SLOT =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

  async function getImplementationAddress(
    hre: HardhatRuntimeEnvironment,
    proxyAddress: string
  ) {
    const implHex = await hre.ethers.provider.getStorageAt(
      proxyAddress,
      _ERC1967_IMPLEMENTATION_SLOT
    );

    return ethers.utils.getAddress(hre.ethers.utils.hexStripZeros(implHex));
  }

  async function impersonateAccount(
    hre: HardhatRuntimeEnvironment,
    acctAddress: string
  ) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [acctAddress],
    });
    // It might be a multisig contract, in which case we also need to pretend it has money for gas
    await hre.ethers.provider.send("hardhat_setBalance", [
      acctAddress,
      "0x10000000000000000000",
    ]);
  }

  async function getSigner(
    hre: HardhatRuntimeEnvironment,
    acctAddress: string
  ) {
    if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
      // We can impersonate the account
      await impersonateAccount(hre, acctAddress);
    }
    return await hre.ethers.getSigner(acctAddress);
  }

  const { multisig } = await hre.getNamedAccounts();
  const multisigSigner = await getSigner(hre, multisig);

  const info = {
    periphery: "0x07ceD903E6ad0278CC32bC83a3fC97112F763722",
    newPeripheryImplementation: "0x74ef2B06A1D2035C33244A4a263FF00B84504865",
  };

  const periphery = (await hre.ethers.getContractAt(
    "Periphery",
    info.periphery
  )) as Periphery;

  await periphery
    .connect(multisigSigner)
    .upgradeTo(info.newPeripheryImplementation);

  const newImplAddress = await getImplementationAddress(hre, info.periphery);
  console.log(
    `Periphery at ${info.periphery} has been upgraded from implementation ... to ${newImplAddress}`
  );
});

task("checkSettlements", "Check settlements")
  .addParam(
    "marginEngineAddress",
    "Queried Margin Engine",
    "0x0000000000000000000000000000000000000000",
    types.string
  )
  .setAction(async (taskArgs, hre) => {
    if (!(hre.network.name === "localhost")) {
      throw new Error("Only localhost");
    }

    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      taskArgs.marginEngineAddress
    )) as MarginEngine;

    const fs = require("fs");
    const file = `${taskArgs.marginEngineAddress}.csv`;

    const header = "owner,lower_tick,upper_tick,margin_settlement";

    fs.appendFileSync(file, header + "\n");
    console.log(header);

    // advance time by 180 days to reach maturity
    if (hre.network.name === "localhost") {
      await hre.network.provider.send("evm_increaseTime", [86400 * 180]);
      await hre.network.provider.send("evm_mine", []);
    }

    for (const key in positionsJson.positions) {
      const position = positionsJson.positions[key];

      if (position.marginEngine === taskArgs.marginEngineAddress) {
        await marginEngine.settlePosition(
          position.owner,
          position.tickLower,
          position.tickUpper
        );

        const positionInfo = await marginEngine.callStatic.getPosition(
          position.owner,
          position.tickLower,
          position.tickUpper
        );

        console.log(
          position.owner,
          position.tickLower,
          position.tickUpper,
          ethers.utils.formatEther(positionInfo.margin)
        );
        fs.appendFileSync(
          file,
          `${position.owner},${position.tickLower},${
            position.tickUpper
          },${ethers.utils.formatEther(positionInfo.margin)}\n`
        );
      }
    }
  });

module.exports = {};
