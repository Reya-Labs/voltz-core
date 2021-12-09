// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./IAMM.sol";
import "./IVAMM.sol";
import "./IPositionStructs.sol";


interface IMarginEngine is IPositionStructs {
    
    function amm() external view returns (IAMM);

    function setAMM(address _ammAddress) external;

    function updatePositionMargin(ModifyPositionParams memory params, int256 marginDelta) external;

    function updateTraderMargin(address recipient, int256 marginDelta) external;

    function settlePosition(ModifyPositionParams memory params) external;

    function settleTrader(address recipient) external;

    function liquidatePosition(ModifyPositionParams memory params) external;

    function liquidateTrader(address traderAddress) external;

    /// @notice Returns the information about a position by the position's key
    /// @param key The position's key is a hash of a preimage composed by the owner, tickLower and tickUpper
    function positions(bytes32 key)
        external
        view
        returns (
        uint128 _liquidity,
        int256 margin,
        int256 fixedTokenGrowthInsideLast,
        int256 variableTokenGrowthInsideLast,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        uint256 feeGrowthInsideLast,
        bool isBurned // todo: properly define what isBurned means in this context
        );

    /// @notice Returns the information about a trader by the trader key
    /// @param key The trader's key is a hash of a preimage composed by the owner, notional, fixedRate
    function traders(bytes32 key)
        external
        view
        returns (
        int256 margin,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        bool settled
        );

    function updatePosition(IVAMM.ModifyPositionParams memory params, IVAMM.UpdatePositionVars memory vars) external;

    function updateTraderBalances(address recipient, int256 fixedTokenBalance, int256 variableTokenBalance) external;

    function unwindPosition(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) external returns(int256 _fixedTokenBalance, int256 _variableTokenBalance);

    function checkPositionMarginRequirementSatisfied(
            address recipient,
            int24 tickLower,
            int24 tickUpper,
            uint128 amount
        ) external;

}