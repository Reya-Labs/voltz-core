pragma solidity ^0.8.0;
import "../interfaces/IDeployer.sol";
import {TestAMM} from "./TestAMM.sol";
import {TestVAMM} from "./TestVAMM.sol";
import {TestMarginEngine} from "./TestMarginEngine.sol";

contract TestDeployer is IDeployer {

  struct AMMParameters {
    address factory;
    address underlyingToken;
    bytes32 rateOracleId;
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

    vamm = address(
      new TestVAMM{
        salt: keccak256(
          // think don't need tickSpacing here
          abi.encode(
            ammAddress
          )
        )
      }()
    );
    
    delete vammParameters;
  
  }

  function deployMarginEngine(
    // address factoryAddress,
    address ammAddress
  ) external returns (address vamm) {
      
    marginEngineParameters = MarginEngineAndVAMMParameters({
      ammAddress: ammAddress
    });

    vamm = address(
      new TestVAMM{
        salt: keccak256(
          // think don't need tickSpacing here
          abi.encode(
            ammAddress
          )
        )
      }()
    );
    
    delete vammParameters;
  
  }

  function deployAMM(
    address factory,
    address underlyingToken,
    bytes32 rateOracleId,
    uint256 termStartTimestamp,
    uint256 termEndTimestamp
  ) internal returns (address amm) {

    ammParameters = AMMParameters({
      factory: factory,
      underlyingToken: underlyingToken,
      rateOracleId: rateOracleId,
      termStartTimestamp: termStartTimestamp,
      termEndTimestamp: termEndTimestamp
    });

    amm = address(
      new TestAMM{
        salt: keccak256(
          abi.encode(
            rateOracleId,
            underlyingToken, // redundunt since the rateOracleId incorporates the underlying token?
            termStartTimestamp,
            termEndTimestamp
          )
        )
      }()
    );
    delete ammParameters;
  }


}