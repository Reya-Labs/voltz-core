pragma solidity ^0.8.0;

import "../interfaces/IAMMDeployer.sol";

import "./MockTimeAMM.sol";

contract MockTimeAMMDeployer is IAMMDeployer {
    struct Parameters {
        address factory;
        address underlyingToken;
        address underlyingPool;
        uint256 termInDays;
        uint256 termStartTimestamp;
        uint24 fee;
        int24 tickSpacing;
    }

    Parameters public override parameters;

    event AMMDeployed(address amm);

    function deploy(
        address factory,
        address underlyingToken,
        address underlyingPool,
        uint256 termInDays,
        uint24 fee,
        int24 tickSpacing
    ) external returns (address amm) {
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
            new MockTimeAMM{
                salt: keccak256(
                    abi.encodePacked(
                        underlyingPool,
                        termInDays,
                        _termStartTimestamp,
                        fee
                    )
                )
            }()
        );
        emit AMMDeployed(amm);
        delete parameters;
    }
}
