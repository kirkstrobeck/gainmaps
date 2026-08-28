# Contributing to gainmap

Contributions are welcome.

Repository: https://github.com/kirkstrobeck/gainmaps

This package is the `gainmap` CLI (`packages/gainmap`). Issues and pull requests are appreciated — small, focused changes are easiest to review.

## Develop

```sh
git clone https://github.com/kirkstrobeck/gainmaps.git
cd gainmaps.com
pnpm install
pnpm --filter gainmap test
pnpm --filter gainmap build
```

Tests must stay at 100% coverage.

## End-to-end tests

Fixture inputs live in `test/fixtures/input/` and are generated once:

```sh
node e2e/generate-fixtures.mjs
```

Golden outputs and checksums are generated from the built CLI:

```sh
npm run build
bash e2e/generate-goldens.sh
```

Re-run `generate-goldens.sh` whenever the encoder changes in a way that legitimately alters output, then commit the updated `test/fixtures/expected/` and `test/fixtures/checksums.sha256`.

The e2e checksum tests (`e2e/run.sh` step 16 and `test/e2e-checksum.test.ts`) verify checksums
by re-running each scenario through the CLI and hashing the fresh output — not by reading
the committed files in `expected/`. The `expected/` files are kept as reference goldens only.

The shell e2e runner exercises the installed binary end-to-end:

```sh
GAINMAP_BIN=node\ dist/cli.js sh e2e/run.sh
```

A multi-stage Dockerfile (`Dockerfile.e2e`) tests npm global install, curl installer, and simulated Homebrew install in isolation:

```sh
docker build -f packages/gainmap/Dockerfile.e2e .
```

## Style

- No `let`. No control-flow mutation. No `else` — prefer early returns and small functions.
- Import via `#src/...`, not relative paths.
- `export default` functions are named `Base`.
