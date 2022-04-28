// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

import "../interfaces/IMarginEngine.sol";

contract TestLiquidatorBot {
    IMarginEngine public marginEngine;

    constructor() {}

    function setMarginEngine(IMarginEngine _marginEngine) external {
        // in order to restrict this function to only be callable by the owner of the bot you can apply the onlyOwner modifier by OZ
        require(address(_marginEngine) != address(0), "me must exist");
        require(
            (address(marginEngine) != address(_marginEngine)),
            "me already set"
        );
        marginEngine = _marginEngine;
    }

    function getMELiquidatorRewardWad() external view returns (uint256) {
        require(address(marginEngine) != address(0), "me must be set");
        return marginEngine.liquidatorRewardWad();
    }

    function getLiquidationMarginRequirement(
        address _recipient,
        int24 _tickLower,
        int24 _tickUpper
    ) external returns (uint256) {
        require(address(marginEngine) != address(0), "me must be set");

        return
            marginEngine.getPositionMarginRequirement(
                _recipient,
                _tickLower,
                _tickUpper,
                true // isLM, i.e. is liquidation margin
            );
    }

    function liquidatePosition(
        address _owner,
        int24 _tickLower,
        int24 _tickUpper
    ) external returns (uint256) {
        require(address(marginEngine) != address(0), "me must be set");

        return marginEngine.liquidatePosition(_owner, _tickLower, _tickUpper);
    }
}
