// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract ScribbleTest {
   
    /// #if_succeeds {:msg "test scribble annotation"} c == a + b;
    function testScribble(uint a, uint b) public pure returns (uint c) {
        c = a-1+b+1;
    }
}
