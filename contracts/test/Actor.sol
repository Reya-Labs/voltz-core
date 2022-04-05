// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;

import "contracts/test/TestMarginEngine.sol";
import "contracts/test/TestVAMM.sol";
import "contracts/test/TestAaveFCM.sol";
import "contracts/utils/Printer.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";
import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "../interfaces/IFactory.sol";
import "../interfaces/IPeriphery.sol";
import "../utils/WadRayMath.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "contracts/utils/CustomErrors.sol";

contract Actor is CustomErrors {
    function mintOrBurnViaPeriphery(
        address peripheryAddress,
        IPeriphery.MintOrBurnParams memory params
    ) external returns (int256 positionMarginRequirement) {
        positionMarginRequirement = IPeriphery(peripheryAddress).mintOrBurn(
            params
        );
    }

    function swapViaPeriphery(
        address peripheryAddress,
        IPeriphery.SwapPeripheryParams memory params
    )
        external
        returns (
            int256 _fixedTokenDelta,
            int256 _variableTokenDelta,
            uint256 _cumulativeFeeIncurred,
            int256 _fixedTokenDeltaUnbalanced,
            int256 _marginRequirement
        )
    {
        (
            _fixedTokenDelta,
            _variableTokenDelta,
            _cumulativeFeeIncurred,
            _fixedTokenDeltaUnbalanced,
            _marginRequirement,

        ) = IPeriphery(peripheryAddress).swap(params);
    }

    function updatePositionMarginViaAMM(
        address MEAddress,
        address _owner,
        int24 tickLower,
        int24 tickUpper,
        int256 marginDelta
    ) public {
        IMarginEngine(MEAddress).updatePositionMargin(
            _owner,
            tickLower,
            tickUpper,
            marginDelta
        );
    }

    function settlePositionViaAMM(
        address MEAddress,
        address _owner,
        int24 tickLower,
        int24 tickUpper
    ) public {
        IMarginEngine(MEAddress).settlePosition(_owner, tickLower, tickUpper);
    }

    function mintViaAMM(
        address VAMMAddress,
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external returns (int256 positionMarginRequirement) {
        positionMarginRequirement = IVAMM(VAMMAddress).mint(
            recipient,
            tickLower,
            tickUpper,
            amount
        );
    }

    function burnViaAMM(
        address VAMMAddress,
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external {
        IVAMM(VAMMAddress).burn(recipient, tickLower, tickUpper, amount);
    }

    function swapViaAMM(address VAMMAddress, IVAMM.SwapParams memory params)
        external
        returns (
            int256 _fixedTokenDelta,
            int256 _variableTokenDelta,
            uint256 _cumulativeFeeIncurred,
            int256 _fixedTokenDeltaUnbalanced,
            int256 _marginRequirement
        )
    {
        (
            _fixedTokenDelta,
            _variableTokenDelta,
            _cumulativeFeeIncurred,
            _fixedTokenDeltaUnbalanced,
            _marginRequirement
        ) = IVAMM(VAMMAddress).swap(params);
    }

    function setIntegrationApproval(
        address MEAddress,
        address intAddress,
        bool allowIntegration
    ) external {
        // get the factory
        IFactory factory = IMarginEngine(MEAddress).factory();
        // set integration approval
        factory.setApproval(intAddress, allowIntegration);
    }

    function liquidatePosition(
        address MEAddress,
        int24 tickLower,
        int24 tickUpper,
        address owner
    ) external {
        IMarginEngine(MEAddress).liquidatePosition(owner, tickLower, tickUpper);
    }

    function initiateFullyCollateralisedFixedTakerSwap(
        address FCMAddress,
        uint256 notional,
        uint160 sqrtPriceLimitX96
    ) external {
        IFCM(FCMAddress).initiateFullyCollateralisedFixedTakerSwap(
            notional,
            sqrtPriceLimitX96
        );
    }

    function unwindFullyCollateralisedFixedTakerSwap(
        address FCMAddress,
        uint256 notionalToUnwind,
        uint160 sqrtPriceLimitX96
    ) external {
        IFCM(FCMAddress).unwindFullyCollateralisedFixedTakerSwap(
            notionalToUnwind,
            sqrtPriceLimitX96
        );
    }

    function settleYBATrader(address FCMAddress) external {
        IFCM(FCMAddress).settleTrader();
    }

    function settlePosition(
        address MEAdrress,
        address recipient,
        int24 tickLower,
        int24 tickUpper
    ) external {
        IMarginEngine(MEAdrress).settlePosition(
            recipient,
            tickLower,
            tickUpper
        );
    }
}
