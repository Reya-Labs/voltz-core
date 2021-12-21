pragma solidity ^0.8.0;

import "../VAMM.sol";


contract TestVAMM is VAMM {

    function mintTest(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external {
        mint(
            recipient,
            tickLower,
            tickUpper,
            amount
        );
    }

}