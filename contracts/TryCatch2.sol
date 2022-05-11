// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.9;

import "contracts/utils/CustomErrors.sol";

contract TryCatch2 {

    function thrower() external returns (uint256) {
            revert CustomErrors.MarginRequirementNotMet(
                123, // _positionMarginRequirement,
                2, // _v.tick,
                3, // _fixedTokenDelta,
                4, // _variableTokenDelta,
                5, // _cumulativeFeeIncurred,
                6 // _fixedTokenDeltaUnbalanced
            );
            return 44;
    }

    function split(bytes memory data, uint8 startIndex, uint8 length) internal returns (bytes memory) {
      bytes memory data1 = new bytes(length);
      for (uint i = startIndex; i < startIndex + length; i++) {
          data1[i] = data[i];
      }
      return data1;
  }

    function catcher() public returns (uint256 extractedValue) {
        try this.thrower() returns (uint v) {
            return v + 1;
        } catch (bytes memory reason) {
            bytes4 expectedSelector = CustomErrors.MarginRequirementNotMet.selector;
            bytes4 receivedSelector = bytes4(reason);
            // assertEq(expectedSelector, receivedSelector);
            return 55;
        }

    }
}