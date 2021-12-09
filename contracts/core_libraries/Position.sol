// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../utils/FullMath.sol";
import "../utils/FixedPoint128.sol";
import "../utils/LiquidityMath.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "prb-math/contracts/PRBMathUD60x18Typed.sol";

/// @title Position
/// @notice Positions represent an owner address' liquidity between a lower and upper tick boundary
/// @dev Positions store additional state for tracking fees owed to the position
library Position {
  using Position for Position.Info;

  // info stored for each user's position
  struct Info {
    uint128 _liquidity;
    int256 margin;
    int256 fixedTokenGrowthInsideLast;
    int256 variableTokenGrowthInsideLast;
    int256 fixedTokenBalance;
    int256 variableTokenBalance;
    uint256 feeGrowthInsideLast;
    bool isBurned;
  }

  /// @notice Returns the Info struct of a position, given an owner and position boundaries
  /// @param self The mapping containing all user positions
  /// @param owner The address of the position owner
  /// @param tickLower The lower tick boundary of the position
  /// @param tickUpper The upper tick boundary of the position
  /// @return position The position info struct of the given owners' position
  function get(
    mapping(bytes32 => Info) storage self,
    address owner,
    int24 tickLower,
    int24 tickUpper
  ) internal view returns (Position.Info storage position) {
    position = self[keccak256(abi.encodePacked(owner, tickLower, tickUpper))];
  }

  function updateMargin(Info storage self, int256 marginDelta) internal {
    Info memory _self = self;
    self.margin = PRBMathSD59x18Typed
      .add(
        PRBMath.SD59x18({ value: _self.margin }),
        PRBMath.SD59x18({ value: marginDelta })
      )
      .value;
  }

  /// #if_succeeds fixedTokenBalanceDelta!=0 || variableTokenBalanceDelta!=0;
  function updateBalances(
    Info storage self,
    int256 fixedTokenBalanceDelta,
    int256 variableTokenBalanceDelta
  ) internal {
    // todo: turn into a require statement?
    if (fixedTokenBalanceDelta != 0 || variableTokenBalanceDelta != 0) {
      Info memory _self = self;

      self.fixedTokenBalance = PRBMathSD59x18Typed
        .add(
          PRBMath.SD59x18({ value: _self.fixedTokenBalance }),
          PRBMath.SD59x18({ value: fixedTokenBalanceDelta })
        )
        .value;

      self.variableTokenBalance = PRBMathSD59x18Typed
        .add(
          PRBMath.SD59x18({ value: _self.variableTokenBalance }),
          PRBMath.SD59x18({ value: variableTokenBalanceDelta })
        )
        .value;
    }
  }

  function calculateFeeDelta(Info storage self, uint256 feeGrowthInside)
    internal
    pure
    returns (uint256 _feeDelta)
  {
    Info memory _self = self;

    require(_self._liquidity > 0, "NP");

    _feeDelta = PRBMathUD60x18Typed
      .mul(
        PRBMathUD60x18Typed.sub(
          PRBMath.UD60x18({ value: feeGrowthInside }),
          PRBMath.UD60x18({ value: _self.feeGrowthInsideLast })
        ),
        PRBMath.UD60x18({ value: uint256(_self._liquidity) * 10**18 })
      )
      .value;
  }

  /// #if_succeeds fixedTokenGrowthInside==_self.fixedTokenGrowthInsideLast ==> _fixedTokenBalance == 0;
  /// #if_succeeds variableTokenGrowthInside==_self.variableTokenGrowthInsideLast ==> _variableTokenBalance == 0;
  /// #if_succeeds _self._liquidity > 0;
  function calculateFixedAndVariableDelta(
    Info storage self,
    int256 fixedTokenGrowthInside,
    int256 variableTokenGrowthInside
  )
    internal
    pure
    returns (int256 _fixedTokenDelta, int256 _variableTokenDelta)
  {
    Info memory _self = self;

    require(_self._liquidity > 0, "NP");

    _fixedTokenDelta = PRBMathSD59x18Typed
      .mul(
        PRBMathSD59x18Typed.sub(
          PRBMath.SD59x18({ value: fixedTokenGrowthInside }),
          PRBMath.SD59x18({ value: _self.fixedTokenGrowthInsideLast })
        ),
        PRBMath.SD59x18({ value: int256(uint256(_self._liquidity)) * 10**18 })
        // PRBMath.SD59x18({value: 10**18 })
      )
      .value;

    _variableTokenDelta = PRBMathSD59x18Typed
      .mul(
        PRBMathSD59x18Typed.sub(
          PRBMath.SD59x18({ value: variableTokenGrowthInside }),
          PRBMath.SD59x18({ value: _self.variableTokenGrowthInsideLast })
        ),
        PRBMath.SD59x18({ value: int256(uint256(_self._liquidity)) * 10**18 })
        // PRBMath.SD59x18({value: 10**18 })
      )
      .value;
  }

  function updateFixedAndVariableTokenGrowthInside(
    Info storage self,
    int256 fixedTokenGrowthInside,
    int256 variableTokenGrowthInside
  ) internal {
    self.fixedTokenGrowthInsideLast = fixedTokenGrowthInside;
    self.variableTokenGrowthInsideLast = variableTokenGrowthInside;
  }

  function updateFeeGrowthInside(Info storage self, uint256 feeGrowthInside)
    internal
  {
    self.feeGrowthInsideLast = feeGrowthInside;
  }

  /// @notice Credits accumulated fees to a user's position
  /// @param self The individual position to update
  /// @param liquidityDelta The change in pool liquidity as a result of the position update

  /// #if_succeeds liquidityDelta != 0;
  function updateLiquidity(Info storage self, int128 liquidityDelta) internal {
    Info memory _self = self;

    uint128 liquidityNext;
    if (liquidityDelta == 0) {
      require(_self._liquidity > 0, "NP"); // disallow pokes for 0 liquidity positions
      liquidityNext = _self._liquidity;
    } else {
      liquidityNext = LiquidityMath.addDelta(_self._liquidity, liquidityDelta);
    }

    // update the position
    // todo: have a timestamp that check when was the last time the position was updated and avoids the update cost
    if (liquidityDelta != 0) self._liquidity = liquidityNext;
  }
}
