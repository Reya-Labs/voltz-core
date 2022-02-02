// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract ScribbleTest {
    error FirstValueShouldBePositive();

    /// #if_succeeds {:msg "test scribble annotation"} c == a + b;
    function testScribble(uint256 a, uint256 b)
        public
        pure
        returns (uint256 c)
    {
        if (a > 0) {
            c = a - 1 + b + 1;
        } else {
            revert FirstValueShouldBePositive();
        }
    }
}
