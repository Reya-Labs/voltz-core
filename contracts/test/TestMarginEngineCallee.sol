pragma solidity ^0.8.0;
import "../MarginEngine.sol";
import "../interfaces/IMarginEngine.sol";


contract TestMarginEngineCallee {
  
  function updateTraderMarginTest(address marginEngine, address recipient, int256 marginDelta) external {
    IMarginEngine(marginEngine).updateTraderMargin(recipient, marginDelta);
  }

}