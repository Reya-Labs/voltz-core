pragma solidity ^0.8.0;

import "../utils/SafeCast.sol";
import "../utils/TickMath.sol";
import "../interfaces/IAMM.sol";
import "../AMM.sol";

contract TestAMM is AMM {
    using SafeCast for uint256;

    function getAMMFee(address amm) external returns(uint256) {
        return IAMM(amm).fee();
    }

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

