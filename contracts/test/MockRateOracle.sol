// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.9;

// Minimal mock of a rate oracle specifically for margin requirements testing
// Margin requirement calcultation only calls variableFactor in the rate oracle
contract MockRateOracle {
    uint256 variableFactorWad;
    uint256 apyFromToWad;

    function variableFactor(
        uint256 termStartTimestampInWeiSeconds,
        uint256 termEndTimestampInWeiSeconds
    ) public view returns (uint256) {
        return variableFactorWad;
    }

    function getApyFromTo(uint256 from, uint256 to)
        public
        view
        returns (uint256 apyFromToWad)
    {
        return apyFromToWad;
    }

    function setVariableFactor(uint256 _variableFactor) public {
        variableFactorWad = _variableFactor;
    }

    function setApyFromTo(uint256 _apyFromTo) public {
        apyFromToWad = _apyFromTo;
    }
}
