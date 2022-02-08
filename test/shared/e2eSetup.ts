import { BigNumber } from "@ethersproject/bignumber";
import { toBn } from "evm-bn";
import { consts } from "../helpers/constants";
import { TICK_SPACING } from "./utilities";

const Minter1 = 0;
const Minter2 = 1;
const Minter3 = 2;
const Minter4 = 3;
const Minter5 = 4;

const Swapper1 = 0;
const Swapper2 = 1;
const Swapper3 = 2;
const Swapper4 = 3;
const Swapper5 = 4;

export interface MintAction {
    index: number, // index of position
    liquidity: BigNumber // liquidity to mint (in wad)
};

export interface BurnAction {
    index: number, // index of position
    liquidity: BigNumber // liquidity to burn (in wad)
};

export interface UpdatePositionMarginAction {
    index: number, // index of position
    margin: BigNumber // margin to add
};

export interface UpdateTraderMarginAction {
    index: number, // index of swapper
    margin: BigNumber // margin to add
};

export interface SwapAction {
    index: number, // index of swapper
    isFT: boolean,
    amountSpecified: BigNumber, // number of variable tokens in wad
    sqrtPriceLimitX96: BigNumber // limit of price
};

export interface SkipAction {
    time: BigNumber,
    blockCount: number,
    reserveNormalizedIncome: number
};

export interface e2eParameters {
    duration: BigNumber;
    numMinters: number;
    numSwappers: number;
    positions: [number, number, number][]; // list of [index of minter, lower tick, upper tick]
    traders: number[]; // list of index of swapper
    actions: (SkipAction | SwapAction | UpdateTraderMarginAction | UpdatePositionMarginAction | BurnAction | MintAction)[];
}

export const e2eScenarios: e2eParameters[] = [
    {
        duration: consts.ONE_MONTH.mul(3),
        numMinters: 2,
        numSwappers: 2,
        positions: [[Minter1, -TICK_SPACING, TICK_SPACING], [Minter2, -3 * TICK_SPACING, -TICK_SPACING]],
        traders: [Swapper1, Swapper2],
        actions: []
    },
]