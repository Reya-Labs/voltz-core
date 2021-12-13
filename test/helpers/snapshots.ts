import { MockProvider } from "ethereum-waffle";

const snapshotIdStack: number[] = [];

export const createSnapshot = async (
  provider: MockProvider
): Promise<number> => {
  const id = await provider.send("evm_snapshot", []);
  snapshotIdStack.push(id);
  return id;
};

export const restoreSnapshot = async (
  provider: MockProvider,
  snapshotId?: number
) => {
  const id =
    snapshotId || snapshotId === 0 ? snapshotId : snapshotIdStack.pop();
  try {
    await provider.send("evm_revert", [id]);
  } catch (ex) {
    throw new Error(`Snapshot with id #${id} failed to revert`);
  }
};
