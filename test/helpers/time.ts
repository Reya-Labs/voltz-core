import { network, waffle } from "hardhat";
import { assert } from "chai";
import { MockProvider } from "ethereum-waffle";
import { BigNumber } from "ethers";

export const getCurrentTimestamp = async (_provider?: MockProvider) => {
  const provider = _provider || waffle.provider;
  const block = await provider.getBlock("latest");
  return block.timestamp;
};

export async function setTimeNextBlock(_time: BigNumber | number) {
  const time = typeof _time === "number" ? _time : _time.toNumber();
  await network.provider.send("evm_setNextBlockTimestamp", [time]);
}

// add return type
export async function evm_snapshot() {
  return await network.provider.request({
    method: "evm_snapshot",
    params: [],
  });
}

export async function evm_revert(snapshotId: string) {
  return await network.provider.request({
    method: "evm_revert",
    params: [snapshotId],
  });
}

export async function advanceTime(_duration: BigNumber | number) {
  const duration =
    typeof _duration === "number" ? _duration : _duration.toNumber();
  await network.provider.send("evm_increaseTime", [duration]);
  await network.provider.send("evm_mine", []);
}

export async function setTime(time: BigNumber) {
  await network.provider.send("evm_setNextBlockTimestamp", [time.toNumber()]);
  await network.provider.send("evm_mine", []);
}

export async function mineBlock(count?: number) {
  if (count == null) count = 1;
  while (count-- > 0) {
    await network.provider.send("evm_mine", []);
  }
}

export async function advanceTimeAndBlock(time: BigNumber, blockCount: number) {
  assert(blockCount >= 1);
  await advanceTime(time);
  await mineBlock(blockCount - 1);
}

export async function mineAllPendingTransactions() {
  while (true) {
    const pendingBlock: any = await network.provider.send(
      "eth_getBlockByNumber",
      ["pending", false]
    );
    if (pendingBlock.transactions.length === 0) break;
    await mineBlock();
  }
}

export async function minerStart() {
  await network.provider.send("evm_setAutomine", [true]);
}

export async function minerStop() {
  await network.provider.send("evm_setAutomine", [false]);
}
