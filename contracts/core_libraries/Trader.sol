pragma solidity ^0.8.0;

/// @title Trader
/// @notice Trader represents a holder of an active leg of an IRS position
library Trader {
    // info stored for each user's position
    struct Info {
        int256 notional;
        uint256 fixedRate; // todo: should be int?
        int256 margin;
        int256 fixedTokenBalance;
        int256 variableTokenBalance;
        bool settled;
    }

    /// @notice Returns the Info struct of a trader, given an owner
    /// @param self The mapping containing all user positions
    /// @param owner The address of the position owner
    /// @return trader The position info struct of the given owners' position
    function get(
        mapping(bytes32 => Info) storage self,
        address owner
    ) internal view returns (Trader.Info storage trader) {
        trader = self[
            keccak256(abi.encodePacked(owner))
        ];
    }

    function update(
        Info storage self,
        int256 notional,
        uint256 fixedRate,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        int256 margin,
        bool settled
    ) internal {
        self.notional = notional;
        self.fixedRate = fixedRate;
        self.fixedTokenBalance = fixedTokenBalance;
        self.variableTokenBalance = variableTokenBalance;
        self.margin = margin;
        self.settled = settled;
    }
}
