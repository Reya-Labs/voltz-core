import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { jestSnapshotPlugin } from "mocha-chai-jest-snapshot";
import { near } from "../shared/near";

use(solidity);
use(jestSnapshotPlugin());
use(near);

export { expect };
