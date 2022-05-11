// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.9;

import "contracts/utils/CustomErrors.sol";
import "./TryCatch2.sol";
import "hardhat/console.sol";

contract TryCatch1 {

    TryCatch2 public other;

    constructor() {
        other = new TryCatch2();
    }

    function thrower() external returns (uint256) {
            revert CustomErrors.MarginRequirementNotMet(
                7, // _positionMarginRequirement,
                7, // _v.tick,
                7, // _fixedTokenDelta,
                7, // _variableTokenDelta,
                7, // _cumulativeFeeIncurred,
                7 // _fixedTokenDeltaUnbalanced
            );
            return 44;
    }

    function sliceUint(bytes memory b, uint start)
        internal pure
        returns (uint)
    {
        require(b.length >= start + 32, "slicing out of range");
        uint x;
        assembly {
            x := mload(add(b, add(0x20, start)))
        }
        return x;
    }

    function catcher() public returns (uint256 extractedValue) {
        try other.thrower() returns (uint v) {
            return v + 1;
        } catch (bytes memory reason) {
            bytes4 expectedSelector = CustomErrors.MarginRequirementNotMet.selector;
            bytes4 receivedSelector = bytes4(reason);
            uint256 answer = sliceUint(reason, 4);
            console.log(answer);
            return answer;
        }

    }
}