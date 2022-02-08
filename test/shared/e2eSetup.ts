import { BigNumber } from "@ethersproject/bignumber";
import { consts } from "../helpers/constants";


export interface e2eParameters {
    duration: BigNumber;
    numMinters: number;
    numSwappers: number;
}

export const e2eScenarios: e2eParameters[] = [
    {
        duration: consts.ONE_MONTH.mul(3),
        numMinters: 2,
        numSwappers: 2
    },
]