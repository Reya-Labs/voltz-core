// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../utils/SafeCast.sol";
import "../utils/TickMath.sol";
import "../interfaces/IVAMM.sol";
import "../AMM.sol";

// Warning: Contract code size exceeds 24576 bytes todo: just need to fix VAMM.sol (make it smaller)
contract TestAMM is AMM {
    using SafeCast for uint256;

    // function getAMMFee(address amm) external view returns(uint256) {
    //     return IAMM(amm).fee();
    // }

    function mintTest(
        address amm,
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external {
        IAMM(amm).mint(
            recipient,
            tickLower,
            tickUpper,
            amount
        );
    }

}
