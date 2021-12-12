# PRBMathSD59x18Typed

_Paul Razvan Berg_

> PRBMathSD59x18Typed

Smart contract library for advanced fixed-point math that works with int256 numbers considered to have 18 trailing decimals. We call this number representation signed 59.18-decimal fixed-point, since the numbers can have a sign and there can be up to 59 digits in the integer part and up to 18 decimals in the fractional part. The numbers are bound by the minimum and the maximum values permitted by the Solidity type int256.

_This is the same as PRBMathSD59x18, except that it works with structs instead of raw uint256s._
