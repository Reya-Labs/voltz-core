// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IMarginEngine.sol";
import "../interfaces/IVAMM.sol";
import "contracts/utils/CustomErrors.sol";

interface IPeriphery is CustomErrors {
    struct MintOrBurnParams {
        address marginEngineAddress;
        address recipient;
        int24 tickLower;
        int24 tickUpper;
        uint256 notional;
        bool isMint;
    }

    struct SwapPeripheryParams {
        address marginEngineAddress;
        address recipient;
        bool isFT;
        uint256 notional;
        uint160 sqrtPriceLimitX96;
        int24 tickLower;
        int24 tickUpper;
    }

    // view functions
    function getMarginEngine(address marginEngineAddress)
        external
        pure
        returns (IMarginEngine);

    function getVAMM(address marginEngineAddress) external view returns (IVAMM);

    // non-view functions

    function mintOrBurn(MintOrBurnParams memory params)
        external
        returns (int256 positionMarginRequirement);

    function swap(SwapPeripheryParams memory params)
        external
        returns (
            int256 _fixedTokenDelta,
            int256 _variableTokenDelta,
            uint256 _cumulativeFeeIncurred,
            int256 _fixedTokenDeltaUnbalanced,
            int256 _marginRequirement,
            int24 _tickAfter
        );
}
