// pragma solidity ^0.8.0;

// import "../interfaces/IAMMDeployer.sol";
// import "../core_libraries/FixedAndVariableMath.sol";
// import "./MockTimeAMM.sol";

// contract MockTimeAMMDeployer is IAMMDeployer {
//     struct Parameters {
//         address factory;
//         address underlyingToken;
//         address underlyingPool;
//         uint256 termStartTimestamp;
//         uint256 termEndTimestamp;
//         uint24 fee;
//         int24 tickSpacing;
//     }

//     Parameters public override parameters;

//     event AMMDeployed(address amm);

//     function deploy(
//         address factory,
//         address underlyingToken,
//         address underlyingPool,
//         uint256 termEndTimestamp,
//         uint24 fee,
//         int24 tickSpacing
//     ) external returns (address amm) {
//         uint256 _termStartTimestamp = FixedAndVariableMath.blockTimestampScaled();
//         parameters = Parameters({
//             factory: factory,
//             underlyingToken: underlyingToken,
//             underlyingPool: underlyingPool,
//             termEndTimestamp: termEndTimestamp,
//             termStartTimestamp: _termStartTimestamp,
//             fee: fee,
//             tickSpacing: tickSpacing
//         });
//         amm = address(
//             new MockTimeAMM{
//                 salt: keccak256(
//                     abi.encodePacked(
//                         underlyingPool,
//                         _termStartTimestamp,
//                         termEndTimestamp,
//                         fee
//                     )
//                 )
//             }()
//         );
//         emit AMMDeployed(amm);
//         delete parameters;
//     }
// }
