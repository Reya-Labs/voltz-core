pragma solidity ^0.8.0;

import "../MarginEngine.sol";


contract TestMarginEngine is MarginEngine {

  // maybe need a different constructor 
  // constructor() {  
  //       // address ammAddress;      
  //       // (ammAddress) = IDeployer(msg.sender).marginEngineParameters();
  //       // amm = IAMM(ammAddress);
  //       address ammAddress;
  // }

  function getUnderlyingToken() external view returns(address underlyingToken) {
    return amm.underlyingToken();
  }

  function updateTraderMarginTest(address recipient, int256 marginDelta) external {
    updateTraderMargin(recipient, marginDelta);
  }

}