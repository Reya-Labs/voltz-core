import { task } from "hardhat/config";
import { getConfig } from "../deployConfig/config";
import { getNetworkPoolConfigs } from "../poolConfigs/pool-configs/poolConfig";
import { SinglePoolConfiguration } from "../poolConfigs/pool-configs/types";
import { toBn } from "../test/helpers/toBn";
import {
  Factory,
  IERC20Minimal,
  MarginEngine,
  Periphery,
  VAMM,
} from "../typechain";
import { getSigner } from "./utils/getSigner";
import {
  getPositionRequirements,
  getRateOracleByNameOrAddress,
  sqrtPriceX96AtTick,
  tickAtFixedRate,
} from "./utils/helpers";

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

const formatNumber = (value: number): string => {
  return value.toFixed(0);
};

// Description:
//    - this task impersonates multisig and deploys given pools (whose configurations are present)
//    - it then impersonates underlying token whale and use it to provide 1,000,000 notional between [historicalAPY - 0.5%, historicalAPY + 0.5%]
//    - and then use the same whale to perform one FT and one VT trade (both worth 1,000 notional) -- with different ticks!
//    - for each type of position, it retrieves the margin requirements and outputs the max. initial and liquidation leverages
//
// Example:
//   - open one Terminal (A) and let it run: yarn deploy:empty_mainnet_fork
//   - open another Terminal (B): rm -rf deployments/localhost && cp -p -r deployments/mainnet deployments/localhost
//   - on (B): npx hardhat getPoolLeverages --network localhost aUSDC_v12 stETH_v3 --underlying-network mainnet

task(
  "getPoolLeverages",
  "It simulates initial trades and outputs the leverages"
)
  .addVariadicPositionalParam(
    "pools",
    "The names of pools in deployConfig/poolConfig.ts ('borrow_aDAI_v2 stETH_v1' - skip param name)"
  )
  .addParam("underlyingNetwork", "The underlying network of the fork")
  .setAction(async (taskArgs, hre) => {
    // only for local networks
    if (!(hre.network.name === "localhost")) {
      throw new Error(`Simulation not available for ${hre.network.name}`);
    }

    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const currentTime = currentBlock.timestamp;

    // impersonate multisig wallet
    const network: string = taskArgs.underlyingNetwork;
    const deployConfig = getConfig(network);
    const multisig = await getSigner(hre, deployConfig.multisig);

    // fetch Factory contract (make sure all deployments are copied to localhost)
    const factory = (await hre.ethers.getContract("Factory")) as Factory;

    // fetch pool configurations
    const poolConfigList: SinglePoolConfiguration[] = [];
    const poolConfigs = getNetworkPoolConfigs(network);

    // Validate all pool inputs before processing any
    for (const pool of taskArgs.pools) {
      if (pool in poolConfigs) {
        poolConfigList.push(poolConfigs[pool]);
      } else {
        throw new Error(`No configuration for ${pool}.`);
      }
    }

    for (const poolConfig of poolConfigList) {
      const termStartTimestamp = currentTime;
      const termEndTimestamp = poolConfig.termEndTimestamp;

      const rateOracle = await getRateOracleByNameOrAddress(
        hre,
        poolConfig.rateOracle
      );

      const underlyingTokenAddress = await rateOracle.underlying();

      // deploy IRS instance
      const deployTrx = await factory.connect(multisig).deployIrsInstance(
        underlyingTokenAddress,
        rateOracle.address,
        toBn(termStartTimestamp), // converting to wad
        toBn(termEndTimestamp), // converting to wad
        poolConfig.tickSpacing
      );

      const receipt = await deployTrx.wait();
      const irsEvents = receipt.events;

      if (!receipt.status || !irsEvents) {
        console.error("IRS creation failed!");
        return;
      }

      const event = irsEvents.filter((e) => e.event === "IrsInstance")[0];
      const irsArgs = event.args;

      if (!irsArgs) {
        console.error("IRS creation failed!");
        return;
      }

      console.log(`IRS created successfully. Event args were: ${irsArgs}`);

      const marginEngineAddress = irsArgs[5];
      const vammAddress = irsArgs[6];

      // Fetch margin engine contract
      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        marginEngineAddress
      )) as MarginEngine;

      // Fetch vamm contract
      const vamm = (await hre.ethers.getContractAt(
        "VAMM",
        vammAddress
      )) as VAMM;

      console.log(`Configuring IRS...`);

      const initSqrtPriceX96 = sqrtPriceX96AtTick(poolConfig.initTick);
      const initFixedRate = Math.pow(1.0001, -poolConfig.initTick) / 100;

      console.log(`Setting fixed rate to ${(initFixedRate * 100).toFixed(2)}%`);

      // Set initial price
      {
        const trx = await vamm
          .connect(multisig)
          .initializeVAMM(initSqrtPriceX96);
        await trx.wait();
      }

      // Set margin engine parameters
      {
        const trx = await marginEngine
          .connect(multisig)
          .setMarginCalculatorParameters(poolConfig.marginCalculatorParams);
        await trx.wait();
      }

      // Set cache max age
      {
        const trx = await marginEngine
          .connect(multisig)
          .setCacheMaxAgeInSeconds(poolConfig.cacheMaxAgeInSeconds);
        await trx.wait();
      }

      // Set lookback window
      {
        const trx = await marginEngine
          .connect(multisig)
          .setLookbackWindowInSeconds(poolConfig.lookbackWindowInSeconds);
        await trx.wait();
      }

      // Set liquidator reward
      {
        const trx = await marginEngine
          .connect(multisig)
          .setLiquidatorReward(poolConfig.liquidatorRewardWad);
        await trx.wait();
      }

      // Set protocol fee
      {
        const trx = await vamm
          .connect(multisig)
          .setFeeProtocol(poolConfig.vammFeeProtocolWad);
        await trx.wait();
      }

      // Set LP fee
      {
        const trx = await vamm.connect(multisig).setFee(poolConfig.feeWad);
        await trx.wait();
      }

      console.log(`IRS configured.`);

      // await factory
      //   .connect(multisig)
      //   .setPeriphery((await hre.ethers.getContract("Periphery")).address);

      const periphery = (await hre.ethers.getContractAt(
        "Periphery",
        await factory.periphery()
      )) as Periphery;

      const underlyingToken = (await hre.ethers.getContractAt(
        "IERC20Minimal",
        underlyingTokenAddress
      )) as IERC20Minimal;

      const decimals = await underlyingToken.decimals();

      // impersonate holder wallet
      const holder = await getSigner(
        hre,
        holders[network][underlyingTokenAddress.toLowerCase()]
      );

      // approve tokens to periphery and mint liquidity with spread 0.5%
      {
        const marginDelta = 100000;
        const leverage = 10;
        const notional = marginDelta * leverage;

        const fixedRateLower = Math.max(0.001, initFixedRate - 0.005);
        const fixedRateUpper = initFixedRate + 0.005;

        const tickLower = tickAtFixedRate(fixedRateUpper * 100);
        const tickUpper = tickAtFixedRate(fixedRateLower * 100);

        console.log(`Minting ${notional} between ${tickLower}-${tickUpper}.`);

        {
          const tx = await underlyingToken
            .connect(holder)
            .approve(
              periphery.address,
              hre.ethers.utils.parseUnits(marginDelta.toString(), decimals)
            );

          await tx.wait();
        }

        {
          const tx = await periphery.connect(holder).mintOrBurn({
            marginEngine: marginEngine.address,
            tickLower,
            tickUpper,
            notional: hre.ethers.utils.parseUnits(
              notional.toString(),
              decimals
            ),
            isMint: true,
            marginDelta: hre.ethers.utils.parseUnits(
              marginDelta.toString(),
              decimals
            ),
          });

          await tx.wait();

          const { safetyThreshold: im, liquidationThreshold: lm } =
            await getPositionRequirements(
              marginEngine,
              {
                owner: holder.address,
                tickLower,
                tickUpper,
              },
              decimals
            );

          console.log("max. leverage for LP:");
          console.log(`liquidation: ${formatNumber(notional / lm)}x`);
          console.log(
            `initial: ${formatNumber(notional / im)}x (buffer: ${formatNumber(
              (im / lm) * 100
            )}%)`
          );
          console.log();
        }
      }

      // approve tokens to periphery and trade 1,000 VT
      {
        const marginDelta = 1000;
        const leverage = 1;
        const notional = marginDelta * leverage;

        const tickLower = 0;
        const tickUpper = 60;

        {
          const tx = await underlyingToken
            .connect(holder)
            .approve(
              periphery.address,
              hre.ethers.utils.parseUnits(marginDelta.toString(), decimals)
            );

          await tx.wait();
        }

        {
          const tx = await periphery.connect(holder).swap({
            marginEngine: marginEngine.address,
            isFT: false,
            notional: hre.ethers.utils.parseUnits(
              notional.toString(),
              decimals
            ),
            marginDelta: hre.ethers.utils.parseUnits(
              marginDelta.toString(),
              decimals
            ),
            sqrtPriceLimitX96: "0",
            tickLower,
            tickUpper,
          });

          await tx.wait();

          const { safetyThreshold: im, liquidationThreshold: lm } =
            await getPositionRequirements(
              marginEngine,
              {
                owner: holder.address,
                tickLower,
                tickUpper,
              },
              decimals
            );

          console.log(`im, lm:`, im, lm);

          console.log("max. leverage for VT:");
          console.log(`liquidation: ${formatNumber(notional / lm)}x`);
          console.log(
            `initial: ${formatNumber(notional / im)}x (buffer: ${formatNumber(
              (im / lm) * 100
            )}%)`
          );
          console.log();
        }
      }

      // approve tokens to periphery and trade 1,000 FT
      {
        const marginDelta = 1000;
        const leverage = 1;
        const notional = marginDelta * leverage;

        const tickLower = 0;
        const tickUpper = 120;

        {
          const tx = await underlyingToken
            .connect(holder)
            .approve(
              periphery.address,
              hre.ethers.utils.parseUnits(marginDelta.toString(), decimals)
            );

          await tx.wait();
        }

        {
          const tx = await periphery.connect(holder).swap({
            marginEngine: marginEngine.address,
            isFT: true,
            notional: hre.ethers.utils.parseUnits(
              notional.toString(),
              decimals
            ),
            marginDelta: hre.ethers.utils.parseUnits(
              marginDelta.toString(),
              decimals
            ),
            sqrtPriceLimitX96: "0",
            tickLower,
            tickUpper,
          });

          await tx.wait();

          const { safetyThreshold: im, liquidationThreshold: lm } =
            await getPositionRequirements(
              marginEngine,
              {
                owner: holder.address,
                tickLower,
                tickUpper,
              },
              decimals
            );

          console.log("max. leverage for FT:");
          console.log(`liquidation: ${formatNumber(notional / lm)}x`);
          console.log(
            `initial: ${formatNumber(notional / im)}x (buffer: ${formatNumber(
              (im / lm) * 100
            )}%)`
          );
          console.log();
        }
      }
    }
  });

module.exports = {};
