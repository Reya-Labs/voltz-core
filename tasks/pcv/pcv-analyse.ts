import { task } from "hardhat/config";
import { MarginEngine } from "../../typechain";
import { getPositions } from "@voltz-protocol/subgraph-data";
import { getProtocolSubgraphURL } from "../../scripts/getProtocolSubgraphURL";
import { getConfig } from "../../deployConfig/config";
import { getNetworkPools } from "../../poolConfigs/pool-addresses/pools";
import {
  getPositionInfo,
  getRateOracleByNameOrAddress,
} from "../utils/helpers";
import { getSigner } from "../utils/getSigner";

const holders: { [network: string]: { [token: string]: string } } = {
  mainnet: {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48":
      "0x0A59649758aa4d66E25f08Dd01271e891fe52199",
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2":
      "0xF04a5cC80B1E94C69B48f5ee68a08CD2F09A7c3E",
    "0xdac17f958d2ee523a2206206994597c13d831ec7":
      "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503",
  },
  arbitrum: {
    "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8":
      "0x489ee077994b6658eafa855c308275ead8097c4a",
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1":
      "0x489ee077994b6658eafa855c308275ead8097c4a",
  },
  avalanche: {
    "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e":
      "0x9f8c163cba728e99993abe7495f06c0a3c8ac8b9",
  },
};

// Description:
//   This task generates multisig transactions to settle all positions that are matured or mature in the next 24 hours.
//
// Example:
//   ``npx hardhat pcv-settlePositions --network mainnet``

task("pcv-analyse", "PCV analyse")
  .addOptionalParam(
    "networkName",
    "Name of underlying network when using forks"
  )
  .setAction(async (taskArgs, hre) => {
    // Retrieve multisig address for the current network
    let network = hre.network.name;
    if (taskArgs.networkName) {
      if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
        throw new Error(`Cannot redefine name for network ${hre.network.name}`);
      }

      network = taskArgs.networkName;
    }
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;

    // Retrieve all matured positions
    const currentTimeInMS =
      (await hre.ethers.provider.getBlock("latest")).timestamp * 1000;

    const positions = (
      await getPositions(getProtocolSubgraphURL(network), currentTimeInMS, {
        settled: false,
      })
    ).filter((p) => p.amm.termEndTimestampInMS <= currentTimeInMS);

    if (positions.length === 0) {
      console.warn("No matured positions.");
      return;
    }

    const poolDetailsList = getNetworkPools(network);
    for (const poolName in poolDetailsList) {
      const poolDetails = poolDetailsList[poolName];
      const ammPositions = positions.filter(
        (p) => p.amm.id.toLowerCase() === poolDetails.vamm.toLowerCase()
      );

      if (
        ammPositions.filter(
          (p) => p.owner.toLowerCase() === multisig.toLowerCase()
        ).length === 0
      ) {
        continue;
      }

      console.log("Processing", poolName);

      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        poolDetails.marginEngine
      )) as MarginEngine;

      // Need to upgrade the GLP Margin Engine proxy to old implementation because it is stuck now, ignore.
      const multisigSigner = await getSigner(hre, multisig);
      await marginEngine
        .connect(multisigSigner)
        .upgradeTo("0xbe74538cba79fc440f8809e01b36c97AFBda23Ce");
      // ----------------------------------------------------------------------------------

      const rateOracleAddress = await marginEngine.rateOracle();
      const rateOracle = await getRateOracleByNameOrAddress(
        hre,
        rateOracleAddress
      );
      const underlyingTokenAddress = await rateOracle.underlying();

      // impersonate holder wallet
      const holder = await getSigner(
        hre,
        holders[network][underlyingTokenAddress.toLowerCase()]
      );

      let pendingWithdrawals = 0;
      let multisigPendingWithdrawals = 0;
      for (const position of ammPositions) {
        await marginEngine
          .connect(holder)
          .settlePosition(
            position.owner,
            position.tickLower,
            position.tickUpper
          );

        const { margin } = await getPositionInfo(
          marginEngine,
          position,
          poolDetails.decimals
        );

        pendingWithdrawals += margin;
        if (position.owner.toLowerCase() === multisig.toLowerCase()) {
          multisigPendingWithdrawals += margin;
        }
      }

      console.log(`Pending withdrawals: ${pendingWithdrawals}`);
      console.log(
        `Pending multisig withdrawals: ${multisigPendingWithdrawals}`
      );
    }
  });

task("pcv-analyse-2", "PCV analyse 2")
  .addOptionalParam(
    "networkName",
    "Name of underlying network when using forks"
  )
  .setAction(async (taskArgs, hre) => {
    // Retrieve multisig address for the current network
    let network = hre.network.name;
    if (taskArgs.networkName) {
      if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
        throw new Error(`Cannot redefine name for network ${hre.network.name}`);
      }

      network = taskArgs.networkName;
    }
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;

    // Retrieve all matured positions
    const currentTimeInMS =
      (await hre.ethers.provider.getBlock("latest")).timestamp * 1000;

    const positions = (
      await getPositions(getProtocolSubgraphURL(network), currentTimeInMS, {
        owners: [multisig],
        settled: true,
      })
    ).filter((p) => p.amm.termEndTimestampInMS <= currentTimeInMS);

    if (positions.length === 0) {
      console.warn("No matured positions.");
      return;
    }

    const poolDetailsList = getNetworkPools(network);
    for (const poolName in poolDetailsList) {
      const poolDetails = poolDetailsList[poolName];
      const ammPositions = positions.filter(
        (p) => p.amm.id.toLowerCase() === poolDetails.vamm.toLowerCase()
      );

      if (
        ammPositions.filter(
          (p) => p.owner.toLowerCase() === multisig.toLowerCase()
        ).length === 0
      ) {
        continue;
      }

      console.log("Processing", poolName);

      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        poolDetails.marginEngine
      )) as MarginEngine;

      let multisigPendingWithdrawals = 0;
      for (const position of ammPositions) {
        const { margin } = await getPositionInfo(
          marginEngine,
          position,
          poolDetails.decimals
        );
        // console.log(margin, position);

        multisigPendingWithdrawals += margin;
      }

      if (multisigPendingWithdrawals > 0) {
        console.log(
          `Pending multisig withdrawals: ${multisigPendingWithdrawals}`
        );
      }
    }
  });

module.exports = {};
