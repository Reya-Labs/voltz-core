import { isAddress } from "ethers/lib/utils";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  BaseRateOracle,
  Factory,
  IFCM,
  IMarginEngine,
  IVAMM,
} from "../typechain";
import { ethers, utils } from "ethers";
import { Position } from "../scripts/getPositions";

export async function getRateOracleByNameOrAddress(
  hre: HardhatRuntimeEnvironment,
  _addressOrname: string
): Promise<BaseRateOracle> {
  return (await (isAddress(_addressOrname)
    ? hre.ethers.getContractAt("BaseRateOracle", _addressOrname)
    : hre.ethers.getContract(_addressOrname))) as BaseRateOracle;
}

interface IrsInstance {
  marginEngine: IMarginEngine;
  vamm: IVAMM;
  fcm: IFCM;
}

export async function getIRSByMarginEngineAddress(
  hre: HardhatRuntimeEnvironment,
  marginEngineAddress: string
): Promise<IrsInstance> {
  const marginEngine = (await hre.ethers.getContractAt(
    "IMarginEngine",
    marginEngineAddress
  )) as IMarginEngine;
  const vammAddress = await marginEngine.vamm();
  const fcmAddress = await marginEngine.fcm();

  const vamm = (await hre.ethers.getContractAt("IVAMM", vammAddress)) as IVAMM;
  const fcm = (await hre.ethers.getContractAt("IFCM", fcmAddress)) as IFCM;
  return { marginEngine, vamm, fcm };
}

export async function getIrsInstanceEvents(
  hre: HardhatRuntimeEnvironment
): Promise<utils.LogDescription[]> {
  const factory = (await hre.ethers.getContract("Factory")) as Factory;

  const logs = await factory.queryFilter(factory.filters.IrsInstance());
  const events = logs.map((l) => factory.interface.parseLog(l));
  return events;
}

// It returns the block at given timestamp in a specific network
export async function getBlockAtTimestamp(
  hre: HardhatRuntimeEnvironment,
  timestamp: number
) {
  let lo = 0;
  let hi = (await hre.ethers.provider.getBlock("latest")).number;
  let answer = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const midBlock = await hre.ethers.provider.getBlock(mid);

    if (midBlock.timestamp >= timestamp) {
      answer = midBlock.number;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  return answer;
}

// Sort positions by margin engine, owner, tick lower and tick upper
export function sortPositions(
  positions: Position[],
  poolIndices: {
    [name: string]: { index: number };
  }
): Position[] {
  positions.sort((a, b) => {
    const i_a =
      poolIndices[a.marginEngine.toLowerCase() as keyof typeof poolIndices]
        .index;
    const i_b =
      poolIndices[b.marginEngine.toLowerCase() as keyof typeof poolIndices]
        .index;

    if (i_a === i_b) {
      if (a.owner.toLowerCase() === b.owner.toLowerCase()) {
        if (a.tickLower === b.tickLower) {
          return a.tickUpper - b.tickUpper;
        } else {
          return a.tickLower - b.tickLower;
        }
      } else {
        return a.owner.toLowerCase() < b.owner.toLowerCase() ? -1 : 1;
      }
    } else {
      return i_a < i_b ? -1 : 1;
    }
  });

  return positions;
}

export async function getPositionInfo(
  marginEngine: IMarginEngine,
  position: Position,
  tokenDecimals: number,
  block?: number
): Promise<{
  isSettled: boolean;
  liquidity: number;
  margin: number;
  fixedTokenBalance: number;
  variableTokenBalance: number;
  accumulatedFees: number;
}> {
  const positionInfo = await marginEngine.callStatic.getPosition(
    position.owner,
    position.tickLower,
    position.tickUpper,
    {
      blockTag: block,
    }
  );

  return {
    margin: Number(
      ethers.utils.formatUnits(positionInfo.margin, tokenDecimals)
    ),
    isSettled: positionInfo.isSettled,
    fixedTokenBalance: Number(
      ethers.utils.formatUnits(positionInfo.fixedTokenBalance, tokenDecimals)
    ),
    variableTokenBalance: Number(
      ethers.utils.formatUnits(positionInfo.variableTokenBalance, tokenDecimals)
    ),
    accumulatedFees: Number(
      ethers.utils.formatUnits(positionInfo.accumulatedFees, tokenDecimals)
    ),
    liquidity:
      Number(ethers.utils.formatUnits(positionInfo._liquidity, tokenDecimals)) *
      (1.0001 ** (position.tickUpper / 2) - 1.0001 ** (position.tickLower / 2)),
  };
}

export async function getPositionRequirements(
  marginEngine: IMarginEngine,
  position: Position,
  tokenDecimals: number,
  block?: number
): Promise<{ safetyThreshold: number; liquidationThreshold: number }> {
  const safetyThreshold =
    await marginEngine.callStatic.getPositionMarginRequirement(
      position.owner,
      position.tickLower,
      position.tickUpper,
      false,
      {
        blockTag: block,
      }
    );

  const liquidationThreshold =
    await marginEngine.callStatic.getPositionMarginRequirement(
      position.owner,
      position.tickLower,
      position.tickUpper,
      true,
      {
        blockTag: block,
      }
    );

  return {
    safetyThreshold: Number(
      ethers.utils.formatUnits(safetyThreshold, tokenDecimals)
    ),
    liquidationThreshold: Number(
      ethers.utils.formatUnits(liquidationThreshold, tokenDecimals)
    ),
  };
}
