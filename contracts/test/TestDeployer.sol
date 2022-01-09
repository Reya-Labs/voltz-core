pragma solidity ^0.8.0;
import "../interfaces/IDeployer.sol";
import {TestAMM} from "./TestAMM.sol";
import {TestVAMM} from "./TestVAMM.sol";
import {TestMarginEngine} from "./TestMarginEngine.sol";

contract TestDeployer is IDeployer {
    struct AMMParameters {
        address factory;
        address underlyingToken;
        address rateOracleAddress;
        uint256 termStartTimestamp;
        uint256 termEndTimestamp;
    }

    struct MarginEngineAndVAMMParameters {
        address ammAddress;
    }

    event VAMMDeployed(address vammAddress);
    event AMMDeployed(address ammAddress);
    event MarginEngineDeployed(address marginEngineAddress);

    AMMParameters public override ammParameters;
    MarginEngineAndVAMMParameters public override marginEngineParameters;
    MarginEngineAndVAMMParameters public override vammParameters;

    function deployVAMM(
        // address factoryAddress,
        address ammAddress
    ) external returns (address vamm) {
        vammParameters = MarginEngineAndVAMMParameters({
            ammAddress: ammAddress
        });

        vamm = address(new TestVAMM{salt: keccak256(abi.encode(ammAddress))}());

        emit VAMMDeployed(vamm);

        delete vammParameters;
    }

    function deployMarginEngine(
        // address factoryAddress,
        address ammAddress
    ) external returns (address marginEngine) {
        marginEngineParameters = MarginEngineAndVAMMParameters({
            ammAddress: ammAddress
        });

        marginEngine = address(
            new TestMarginEngine{
                salt: keccak256(
                    // think don't need tickSpacing here
                    abi.encode(ammAddress)
                )
            }()
        );

        emit MarginEngineDeployed(marginEngine);

        delete marginEngineParameters;
    }

    function deployAMM(
        address factory,
        address underlyingToken,
        address rateOracleAddress,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) external returns (address amm) {
        ammParameters = AMMParameters({
            factory: factory,
            underlyingToken: underlyingToken,
            rateOracleAddress: rateOracleAddress,
            termStartTimestamp: termStartTimestamp,
            termEndTimestamp: termEndTimestamp
        });

        amm = address(
            new TestAMM{
                salt: keccak256(
                    abi.encode(
                        rateOracleAddress,
                        underlyingToken, // redundunt since the rateOracleAddress incorporates the underlying token?
                        termStartTimestamp,
                        termEndTimestamp
                    )
                )
            }()
        );

        emit AMMDeployed(amm);

        delete ammParameters;
    }
}
