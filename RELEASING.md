# Releasing `mna`

The release pipeline is driven by tag pushes. Tagging a commit `vX.Y.Z` runs
`.github/workflows/release.yml`, which builds three native binaries
(`darwin-arm64`, `darwin-x64`, `linux-x64`), uploads them to a GitHub
Release as `.tar.gz` + `.sha256`, and publishes the bundled npm package
`@mantacode/mna-cli` to the public registry.

The npm package is `@mantacode/mna-cli`; the binary it installs is `mna`.
The `@mantacode` scope is shared across products, so the package name carries
the product prefix while the command stays short.

## Cutting a release

1. Make sure `main` is green (CI passes, all desired commits are landed).
2. Bump `version` in `package.json` to the next `X.Y.Z`. Commit:

   ```bash
   git commit -am "chore(release): vX.Y.Z"
   ```

3. Tag and push:

   ```bash
   git tag vX.Y.Z
   git push origin main --tags
   ```

4. Watch the **Release** workflow on GitHub Actions. When it completes:
   - A new GitHub Release `vX.Y.Z` exists with three `mna-<target>.tar.gz`
     assets and their `.sha256` files.
   - npm has a new `@mantacode/mna-cli@X.Y.Z` version.

5. Refresh the Homebrew tap (see below).

## Required GitHub secrets

| Secret      | Used by      | How to set up                                                       |
| ----------- | ------------ | ------------------------------------------------------------------- |
| `NPM_TOKEN` | publish-npm  | Generate an **Automation** token on npmjs.com → add to repo secrets |

`GITHUB_TOKEN` is provided automatically by Actions; no setup needed.

## First-release checklist (one-time setup)

These steps only matter the *first* time we release. After that, follow
"Cutting a release" above.

**First-release version: `0.1.0`.** The repo currently sits at `0.0.1`
(never published). `1.0.0` is deliberately reserved: shipping `1.0.0` is the
signal that the `/v1/` API contract is frozen and breaking changes require
`/v2/`. Until then releases stay in the `0.x` range, and `homebrew/mna.rb`
already carries `version "0.1.0"` as its placeholder.

1. **Confirm the npm scope and package name.** `@mantacode` is the owner's
   personal npm scope (username `mantacode`), so no organization needs to be
   created — but a scoped package is private by default, which is why both
   `package.json` (`publishConfig.access`) and the release workflow pass
   `--access public`. Sanity-check the tarball from a clean checkout before
   the first tag:

   ```bash
   bun run codegen
   bun run build
   npm publish --access public --dry-run    # inspect the file list, do not publish
   ```

   The real publish happens from CI on the tag push — do not publish by hand.

2. **Add `NPM_TOKEN` to GitHub repo secrets.** On npmjs.com → User →
   Access Tokens → "Generate New Token" → type **Automation**. Copy the
   token, then on GitHub: Settings → Secrets and variables → Actions →
   New repository secret → `NPM_TOKEN`. **The tag must not be pushed before
   this secret exists** — the `publish-npm` job will fail and the version
   number is then burned (never reuse one).

3. **Create the Homebrew tap repo.** Make a public GitHub repo named
   `mantacode/homebrew-tap` — the `homebrew-` prefix is what lets Homebrew
   resolve `brew install mantacode/tap/mna`. Inside it, create
   `Formula/mna.rb` from this repo's `homebrew/mna.rb` template with the
   SHAs filled in (see next section).

## Refreshing the Homebrew tap after a release

The tap is not automated yet. After every release:

1. Download the three checksum files from the new GitHub Release:

   ```bash
   gh release download vX.Y.Z --pattern '*.sha256' --dir /tmp/mna-vX.Y.Z
   cat /tmp/mna-vX.Y.Z/mna-darwin-arm64.tar.gz.sha256
   cat /tmp/mna-vX.Y.Z/mna-darwin-x64.tar.gz.sha256
   cat /tmp/mna-vX.Y.Z/mna-linux-x64.tar.gz.sha256
   ```

2. In a checkout of `mantacode/homebrew-tap`, edit `Formula/mna.rb`:
   - Update `version "X.Y.Z"`.
   - Replace each `sha256 "..."` with the values from step 1.

3. Commit + push:

   ```bash
   git commit -am "mna vX.Y.Z"
   git push origin main
   ```

4. Verify install works from a clean machine:

   ```bash
   brew install mantacode/tap/mna
   mna --version    # should print X.Y.Z
   ```

A future enhancement will automate the tap update via a GitHub Action
that opens a PR against the tap repo from `release.yml`.

## Rolling back a bad release

- **GitHub Release:** `gh release delete vX.Y.Z --yes` and delete the tag
  (`git tag -d vX.Y.Z && git push --delete origin vX.Y.Z`).
- **npm:** `npm unpublish @mantacode/mna-cli@X.Y.Z` works only within
  72 hours of publish. After that, publish a new patch version with the
  fix. **Never** reuse a version number.
- **Homebrew:** revert the formula commit in the tap repo.
