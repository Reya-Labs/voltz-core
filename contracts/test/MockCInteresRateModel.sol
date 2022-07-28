// SPDX-License-Identifier: BSD-3-Clause
pragma solidity =0.8.9;

import "../interfaces/compound/InterestRateModel.sol";

/**
 * @title Compound's InterestRateModel Interface
 * @author Compound
 */
contract MockCInterestRateModel is InterestRateModel {
    uint256 public borrowRatePerBlock;

    /**
     * @notice Calculates the current borrow interest rate per block
     * @param cash The total amount of cash the market has
     * @param borrows The total amount of borrows the market has outstanding
     * @param reserves The total amount of reserves the market has
     * @return The borrow rate per block (as a percentage, and scaled by 1e18)
     */
    function getBorrowRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) external view override returns (uint256) {
        return borrowRatePerBlock;
    }

    function setBorrowRatePerBlock(uint256 rate) external {
        borrowRatePerBlock = rate;
    }
}
