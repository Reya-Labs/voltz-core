// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
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
        self.margin = self.margin + marginDelta;
    }

    function updateBalances(
        Info storage self,
        int256 fixedTokenBalanceDelta,
        int256 variableTokenBalanceDelta
    ) internal {
        Info memory _self = self;

        int256 fixedTokenBalance = _self.fixedTokenBalance + fixedTokenBalanceDelta;

        int256 variableTokenBalance = _self.variableTokenBalance + variableTokenBalanceDelta;

        self.fixedTokenBalance = fixedTokenBalance;
        self.variableTokenBalance = variableTokenBalance;
    }
}
