import JSBI from 'jsbi'
import { encodeSqrtRatioX96 } from './shared/utilities'
import { expect } from "chai";

export const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))

describe('#encodeSqrtRatioX96', () => {
  it('1/1', () => {
    expect(encodeSqrtRatioX96(1, 1).toString()).to.eq(Q96.toString())
  })

  it('100/1', () => {
    expect(encodeSqrtRatioX96(100, 1).toString()).to.eq(JSBI.BigInt('792281625142643375935439503360').toString())
  })

  it('1/100', () => {
    expect(encodeSqrtRatioX96(1, 100).toString()).to.eq(JSBI.BigInt('7922816251426433759354395033').toString())
  })

  it('111/333', () => {
    expect(encodeSqrtRatioX96(111, 333).toString()).to.eq(JSBI.BigInt('45742400955009932534161870629').toString())
  })

  it('333/111', () => {
    expect(encodeSqrtRatioX96(333, 111).toString()).to.eq(JSBI.BigInt('137227202865029797602485611888').toString())
  })
})