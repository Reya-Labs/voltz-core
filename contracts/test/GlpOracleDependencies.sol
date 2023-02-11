// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

import "../interfaces/glp/IVault.sol";
import "../interfaces/glp/IVault.sol";
import "../interfaces/glp/IGlpManager.sol";
import "../interfaces/glp/IRewardTracker.sol";
import "../interfaces/glp/IRewardRouter.sol";

contract GlpOracleDependencies is
    IGlpManager,
    IVault,
    IRewardTracker,
    IRewardRouter
{
    uint256 _aum;
    uint256 _ethPrice;
    uint256 _glpPrice;
    uint256 _cumulativeRewardPerToken;
    address _rewardToken;

    function getAum(bool maximise) public view override returns (uint256) {
        return _aum;
    }

    function setAum(uint256 aum_) public {
        _aum = aum_;
    }

    function vault() public view override returns (IVault) {
        return IVault(address(this));
    }

    function getMinPrice(address _token)
        public
        view
        override
        returns (uint256)
    {
        return _ethPrice;
    }

    function getMaxPrice(address _token)
        public
        view
        override
        returns (uint256)
    {
        return _ethPrice;
    }

    function getPrice(bool _maximise) public view returns (uint256) {
        return _glpPrice;
    }

    function setGlpPrice(uint256 price_) public {
        _glpPrice = price_;
    }

    function setEthPrice(uint256 price_) public {
        _ethPrice = price_;
    }

    function distributor() public view returns (address) {
        return address(this);
    }

    function feeGlpTracker() public view override returns (address) {
        return address(this);
    }

    function glpManager() public view override returns (address) {
        return address(this);
    }

    function cumulativeRewardPerToken() public view override returns (uint256) {
        return _cumulativeRewardPerToken;
    }

    function setCumulativeRewardPerToken(uint256 rewards_) public {
        _cumulativeRewardPerToken = rewards_;
    }

    function rewardToken() public view override returns (address) {
        return _rewardToken;
    }

    function setRewardToken(address rewardToken_) public {
        _rewardToken = rewardToken_;
    }

    function glp() public view override returns (address) {
        return address(this);
    }

    function totalSupply() public view returns (uint256) {
        return _aum / _glpPrice;
    }
}
