pragma solidity ^0.8.0; // todo: make sure the solidity version doesn't introduce issues

import "./interfaces/IAMMDeployer.sol";
import "./AMM.sol";

contract AMMDeployer is IAMMDeployer {
    struct Parameters {
        address factory;
        address underlyingToken;
        address underlyingPool;
        uint256 termInDays;
        uint256 termStartTimestamp;
        uint24 fee;
        int24 tickSpacing;
    }

    /// @inheritdoc IAMMDeployer
    Parameters public override parameters;

    /// @dev Deploys an amm with the given parameters by transiently setting the parameters storage slot and then
    /// clearing it after deploying the amm.
    /// @param factory The contract address of the Voltz factory
    /// @param underlyingToken The contract address of the token in the underlying pool
    /// @param underlyingPool The contract address of the underlying pool
    /// @param termInDays Number of days between the inception of the pool and its maturity
    /// @param fee The fee collected upon every swap in the pool (as a percentage of notional traded), denominated in hundredths of a bip
    /// @param tickSpacing The spacing between usable ticks
    function deploy(
        address factory,
        address underlyingToken,
        address underlyingPool,
        uint256 termInDays,
        uint24 fee,
        int24 tickSpacing
    ) internal returns (address amm) {
        uint256 _termStartTimestamp = block.timestamp;
        parameters = Parameters({
            factory: factory,
            underlyingToken: underlyingToken,
            underlyingPool: underlyingPool,
            termInDays: termInDays,
            termStartTimestamp: _termStartTimestamp,
            fee: fee,
            tickSpacing: tickSpacing
        });
        amm = address(
            new AMM{
                salt: keccak256(
                    abi.encode(
                        underlyingPool,
                        termInDays,
                        _termStartTimestamp,
                        fee
                    )
                )
            }()
        );
        delete parameters;
    }
}
