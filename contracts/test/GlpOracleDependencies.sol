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
    uint256 _cumulativeRewardPerToken;
    address _rewardToken;

    uint256 _aumMin;
    uint256 _aumMax;
    uint256 _ethPriceMin;
    uint256 _ethPriceMax;
    uint256 _glpSupply;

    function getAum(bool maximise) public view override returns (uint256) {
        return maximise ? _aumMax : _aumMin;
    }

    function setAum(uint256 aum_, bool maximise) public {
        if (maximise) {
            _aumMax = aum_;
        } else {
            _aumMin = aum_;
        }
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
        return _ethPriceMin;
    }

    function getMaxPrice(address _token)
        public
        view
        override
        returns (uint256)
    {
        return _ethPriceMax;
    }

    function setEthPrice(uint256 price_, bool maximise) public {
        if (maximise) {
            _ethPriceMax = price_;
        } else {
            _ethPriceMin = price_;
        }
    }

    function cumulativeRewardPerToken() public view override returns (uint256) {
        return _cumulativeRewardPerToken;
    }

    function setCumulativeRewardPerToken(uint256 rewards_) public {
        _cumulativeRewardPerToken = rewards_;
    }

    function setRewardToken(address rewardToken_) public {
        _rewardToken = rewardToken_;
    }

    function setTotalSupply(uint256 glpSupply_) public {
        _glpSupply = glpSupply_;
    }

    function totalSupply() public view returns (uint256) {
        return _glpSupply;
    }

    // CONTRACT GETTERS
    function distributor() public view returns (address) {
        return address(this);
    }

    function feeGlpTracker() public view override returns (address) {
        return address(this);
    }

    function glpManager() public view override returns (address) {
        return address(this);
    }

    function glp() public view override returns (address) {
        return address(this);
    }

    function rewardToken() public view override returns (address) {
        return _rewardToken;
    }
}
