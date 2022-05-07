// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

import "../interfaces/IMarginEngine.sol";
import "../interfaces/IVAMM.sol";

contract TestActiveLPManagementStrategy {

    IMarginEngine public marginEngine;
    IVAMM public vamm;


    function setMarginEngineAndVAMM(IMarginEngine _marginEngine) external {
        // in order to restrict this function to only be callable by the owner of the bot you can apply the onlyOwner modifier by OZ
        require(address(_marginEngine) != address(0), "me must exist");
        require(
            (address(marginEngine) != address(_marginEngine)),
            "me already set"
        );
        marginEngine = _marginEngine;
        vamm = marginEngine.vamm();
    }

    



}