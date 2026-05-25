#!/usr/bin/env bash
# Cross-compile the mna CLI to standalone Bun binaries for distribution via
# GitHub Releases (and downstream, the Homebrew tap).
#
# Run locally when you want to smoke-test the binary build pipeline; in CI
# the release workflow inlines the same `bun build --compile` invocations.
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p binaries

targets=(
    "bun-darwin-arm64"
    "bun-darwin-x64"
    "bun-linux-x64"
)

for target in "${targets[@]}"; do
    # bun-darwin-arm64 → mna-darwin-arm64
    out="binaries/mna-${target#bun-}"
    echo "Building ${out} (target=${target})..."
    bun build src/bin/mna.ts \
        --compile \
        --target="${target}" \
        --outfile="${out}"
done

echo
echo "Built binaries:"
ls -la binaries/
