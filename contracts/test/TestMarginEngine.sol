pragma solidity ^0.8.0;

import "../MarginEngine.sol";


contract TestMarginEngine is MarginEngine {

  function updateTraderMarginTest(address recipient, int256 marginDelta) external {
    updateTraderMargin(recipient, marginDelta);
  }

}