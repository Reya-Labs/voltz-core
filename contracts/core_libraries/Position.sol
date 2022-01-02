// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/FullMath.sol";
import "../utils/LiquidityMath.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

/// @title Position
/// @notice Positions represent an owner address' liquidity between a lower and upper tick boundary
/// @dev Positions store additional state for tracking fees owed to the position as well as their fixed and variable token balances
library Position {
    using Position for Position.Info;

    // info stored for each user's position
    struct Info {
        // the amount of liquidity owned by this position
        uint128 _liquidity;
        // current margin of the position in terms of the underlyingToken (18 decimals)
        int256 margin;
        // fixed token growth per unit of liquidity as of the last update to liquidity or fixed/variable token balance
        int256 fixedTokenGrowthInsideLast;
        // variable token growth per unit of liquidity as of the last update to liquidity or fixed/variable token balance
        int256 variableTokenGrowthInsideLast;
        // current Fixed Token balance of the position, 1 fixed token can be redeemed for 1% APY * (annualised amm term) at the maturity of the amm
        // assuming 1 token worth of notional "deposited" in the underlying pool at the inception of the amm
        // can be negative/positive/zero
        int256 fixedTokenBalance;
        // current Variable Token Balance of the position, 1 variable token can be redeemed for underlyingPoolAPY*(annualised amm term) at the maturity of the amm
        // assuming 1 token worth of notional "deposited" in the underlying pool at the inception of the amm
        // can be negative/positive/zero
        int256 variableTokenBalance;
        // fee growth per unit of liquidity as of the last update to liquidity or fees owed (via the margin)
        uint256 feeGrowthInsideLast;
        // has the position been already burned
        // a burned position can no longer support new IRS contracts but still needs to cover settlement cash-flows of on-going IRS contracts it entered
        // bool isBurned;, equivalent to having zero liquidity
        // is position settled
        bool isSettled;
    }

    /// @notice Returns the Info struct of a position, given an owner and position boundaries
    /// @param self The mapping containing all user positions
    /// @param owner The address of the position owner
    /// @param tickLower The lower tick boundary of the position
    /// @param tickUpper The upper tick boundary of the position
    /// @return position The position info struct of the given owners' position
    function get(
        mapping(bytes32 => Info) storage self,
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) internal view returns (Position.Info storage position) {
        position = self[
            keccak256(abi.encodePacked(owner, tickLower, tickUpper))
        ];
    }

    function settlePosition(Info storage self) internal {
        self.isSettled = true;
    }

    /// @notice Updates the Info struct of a position by changing the amount of margin according to marginDelta
    /// @param self Position Info Struct of the Liquidity Provider
    /// @param marginDelta Change in the margin account of the position
    function updateMargin(Info storage self, int256 marginDelta) internal {
        Info memory _self = self;
        self.margin = _self.margin + marginDelta;
    }

    /// @notice Updates the Info struct of a position by changing the fixed and variable token balances of the position
    /// @param self Position Info struct of the liquidity provider
    /// @param fixedTokenBalanceDelta Change in the number of fixed tokens in the position's fixed token balance
    /// @param variableTokenBalanceDelta Change in the number of variable tokens in the position's variable token balance
    /// #if_succeeds fixedTokenBalanceDelta!=0 || variableTokenBalanceDelta!=0;
    function updateBalances(
        Info storage self,
        int256 fixedTokenBalanceDelta,
        int256 variableTokenBalanceDelta
    ) internal {
        if (fixedTokenBalanceDelta != 0 || variableTokenBalanceDelta != 0) {
            Info memory _self = self;

            self.fixedTokenBalance =
                _self.fixedTokenBalance +
                fixedTokenBalanceDelta;
            self.variableTokenBalance =
                _self.variableTokenBalance +
                variableTokenBalanceDelta;
        }
    }

    /// @notice Returns Fee Delta = (feeGrowthInside-feeGrowthInsideLast) * liquidity of the position
    /// @param self position info struct represeting a liquidity provider
    /// @param feeGrowthInside fee growth per unit of liquidity as of now
    /// @return _feeDelta Fee Delta
    function calculateFeeDelta(Info storage self, uint256 feeGrowthInside)
        internal
        pure
        returns (uint256 _feeDelta)
    {
        Info memory _self = self;

        require(_self._liquidity > 0, "NP");

        _feeDelta = PRBMathUD60x18.mul(
            feeGrowthInside - _self.feeGrowthInsideLast,
            uint256(_self._liquidity) * 10**18
        );
    }

    /// #if_succeeds fixedTokenGrowthInside==_self.fixedTokenGrowthInsideLast ==> _fixedTokenBalance == 0;
    /// #if_succeeds variableTokenGrowthInside==_self.variableTokenGrowthInsideLast ==> _variableTokenBalance == 0;
    /// #if_succeeds _self._liquidity > 0;

    /// @notice Returns Fixed and Variable Token Deltas
    /// @param self position info struct represeting a liquidity provider
    /// @param fixedTokenGrowthInside fixed token growth per unit of liquidity as of now
    /// @param variableTokenGrowthInside variable token growth per unit of liquidity as of now
    /// @return _fixedTokenDelta = (fixedTokenGrowthInside-fixedTokenGrowthInsideLast) * liquidity of a position
    /// @return _variableTokenDelta = (variableTokenGrowthInside-variableTokenGrowthInsideLast) * liquidity of a position
    function calculateFixedAndVariableDelta(
        Info storage self,
        int256 fixedTokenGrowthInside,
        int256 variableTokenGrowthInside
    )
        internal
        pure
        returns (int256 _fixedTokenDelta, int256 _variableTokenDelta)
    {
        Info memory _self = self;

        // require(_self._liquidity > 0, "NP");

        // liquidity is in wei already

        _fixedTokenDelta = PRBMathSD59x18.mul(
            fixedTokenGrowthInside - _self.fixedTokenGrowthInsideLast,
            int256(uint256(_self._liquidity))
        );

        _variableTokenDelta = PRBMathSD59x18.mul(
            variableTokenGrowthInside - _self.variableTokenGrowthInsideLast,
            int256(uint256(_self._liquidity))
        );
    }

    /// @notice Updates fixedTokenGrowthInsideLast and variableTokenGrowthInsideLast to the current values
    /// @param self position info struct represeting a liquidity provider
    /// @param fixedTokenGrowthInside fixed token growth per unit of liquidity as of now
    /// @param variableTokenGrowthInside variable token growth per unit of liquidity as of now
    function updateFixedAndVariableTokenGrowthInside(
        Info storage self,
        int256 fixedTokenGrowthInside,
        int256 variableTokenGrowthInside
    ) internal {
        self.fixedTokenGrowthInsideLast = fixedTokenGrowthInside;
        self.variableTokenGrowthInsideLast = variableTokenGrowthInside;
    }

    /// @notice Updates feeGrowthInsideLast to the current value
    /// @param self position info struct represeting a liquidity provider
    /// @param feeGrowthInside fee growth per unit of liquidity as of now
    function updateFeeGrowthInside(Info storage self, uint256 feeGrowthInside)
        internal
    {
        self.feeGrowthInsideLast = feeGrowthInside;
    }

    /// #if_succeeds liquidityDelta != 0;

    /// @notice Updates position's liqudity following either mint or a burn
    /// @param self The individual position to update
    /// @param liquidityDelta The change in pool liquidity as a result of the position update
    function updateLiquidity(Info storage self, int128 liquidityDelta)
        internal
    {
        Info memory _self = self;

        uint128 liquidityNext;
        if (liquidityDelta == 0) {
            require(_self._liquidity > 0, "NP"); // disallow pokes for 0 liquidity positions
            liquidityNext = _self._liquidity;
        } else {
            liquidityNext = LiquidityMath.addDelta(
                _self._liquidity,
                liquidityDelta
            );
        }

        if (liquidityDelta != 0) self._liquidity = liquidityNext;
    }
}
