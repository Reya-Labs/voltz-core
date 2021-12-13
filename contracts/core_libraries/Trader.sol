// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "../MarginCalculator.sol";
import "./FixedAndVariableMath.sol";

/// @title Trader
/// @notice Trader represents a holder of an active leg of an IRS position
library Trader {
    // info stored for each user's position
    struct Info {
        int256 margin;
        int256 fixedTokenBalance;
        int256 variableTokenBalance;
        bool isSettled;
    }

    /// @notice Returns the Info struct of a trader, given an owner
    /// @param self The mapping containing all user positions
    /// @param owner The address of the position owner
    /// @return trader The position info struct of the given owners' position
    function get(mapping(bytes32 => Info) storage self, address owner)
        internal
        view
        returns (Trader.Info storage trader)
    {
        trader = self[keccak256(abi.encodePacked(owner))];
    }

    function updateMargin(Info storage self, int256 marginDelta) internal {
        self.margin = PRBMathSD59x18Typed
            .add(
                PRBMath.SD59x18({value: self.margin}),
                PRBMath.SD59x18({value: marginDelta})
            )
            .value;
    }

    function updateBalances(
        Info storage self,
        int256 fixedTokenBalanceDelta,
        int256 variableTokenBalanceDelta
    ) internal {
        Info memory _self = self;

        int256 fixedTokenBalance = PRBMathSD59x18Typed
            .add(
                PRBMath.SD59x18({value: _self.fixedTokenBalance}),
                PRBMath.SD59x18({value: fixedTokenBalanceDelta})
            )
            .value;

        int256 variableTokenBalance = PRBMathSD59x18Typed
            .add(
                PRBMath.SD59x18({value: _self.variableTokenBalance}),
                PRBMath.SD59x18({value: variableTokenBalanceDelta})
            )
            .value;

        self.fixedTokenBalance = fixedTokenBalance;
        self.variableTokenBalance = variableTokenBalance;
    }
}
