.PHONY: test

install:
	yarn
	yarn prepare

install-ci:
	yarn --frozen-lockfile

compile:
	npx hardhat compile

test:
	npx hardhat test

lint:
	echo "lint";

fix:
	echo "fix";

release:
	echo "release";
