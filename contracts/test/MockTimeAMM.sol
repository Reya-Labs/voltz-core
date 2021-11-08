pragma solidity ^0.8.0;

import "../AMM.sol";

// used for testing time dependent behavior
contract MockTimeAMM is AMM {
    // Monday, October 5, 2020 9:00:00 AM GMT-05:00
    uint256 public time = 1601906400;

    function setFeeGrowthGlobalX128(uint256 _feeGrowthGlobalX128) external {
        feeGrowthGlobalX128 = _feeGrowthGlobalX128;
    }

    function advanceTime(uint256 by) external {
        time += by;
    }

    
    // todo: fix this
    // function _blockTimestamp() internal view override returns (uint32) {
    //     return uint32(time);
    // }
}
