# Releasing `mna`

The release pipeline is driven by tag pushes. Tagging a commit `vX.Y.Z` runs
`.github/workflows/release.yml`, which builds three native binaries
(`darwin-arm64`, `darwin-x64`, `linux-x64`), uploads them to a GitHub
Release as `.tar.gz` + `.sha256`, and publishes the bundled npm package
`@mynextadventure/cli` to the public registry.

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
   - npm has a new `@mynextadventure/cli@X.Y.Z` version.

5. Refresh the Homebrew tap (see below).

## Required GitHub secrets

| Secret      | Used by      | How to set up                                                       |
| ----------- | ------------ | ------------------------------------------------------------------- |
| `NPM_TOKEN` | publish-npm  | Generate an **Automation** token on npmjs.com → add to repo secrets |

`GITHUB_TOKEN` is provided automatically by Actions; no setup needed.

## First-release checklist (one-time setup)

These steps only matter the *first* time we release. After that, follow
"Cutting a release" above.

1. **Claim the npm scope and package name.** Sign in to npmjs.com as the
   org owner and create an organization `@mynextadventure` (or use an
   existing one). Confirm `@mynextadventure/cli` is unclaimed and reserve
   it by publishing `0.0.0-prerelease` from a clean checkout if needed:

   ```bash
   bun run codegen
   bun run build
   npm publish --access public --dry-run    # sanity check
   npm publish --access public              # for real
   ```

2. **Add `NPM_TOKEN` to GitHub repo secrets.** On npmjs.com → User →
   Access Tokens → "Generate New Token" → type **Automation**. Copy the
   token, then on GitHub: Settings → Secrets and variables → Actions →
   New repository secret → `NPM_TOKEN`.

3. **Create the Homebrew tap repo.** Make a public GitHub repo named
   `akoso/homebrew-tap` (or `mynextadventure/homebrew-tap`). Inside it,
   create `Formula/mna.rb` from this repo's `homebrew/mna.rb` template
   with the SHAs filled in (see next section).

## Refreshing the Homebrew tap after a release

The tap is not automated yet. After every release:

1. Download the three checksum files from the new GitHub Release:

   ```bash
   gh release download vX.Y.Z --pattern '*.sha256' --dir /tmp/mna-vX.Y.Z
   cat /tmp/mna-vX.Y.Z/mna-darwin-arm64.tar.gz.sha256
   cat /tmp/mna-vX.Y.Z/mna-darwin-x64.tar.gz.sha256
   cat /tmp/mna-vX.Y.Z/mna-linux-x64.tar.gz.sha256
   ```

2. In a checkout of `akoso/homebrew-tap`, edit `Formula/mna.rb`:
   - Update `version "X.Y.Z"`.
   - Replace each `sha256 "..."` with the values from step 1.

3. Commit + push:

   ```bash
   git commit -am "mna vX.Y.Z"
   git push origin main
   ```

4. Verify install works from a clean machine:

   ```bash
   brew tap mynextadventure/tap
   brew install mna
   mna --version    # should print X.Y.Z
   ```

A future enhancement will automate the tap update via a GitHub Action
that opens a PR against the tap repo from `release.yml`.

## Rolling back a bad release

- **GitHub Release:** `gh release delete vX.Y.Z --yes` and delete the tag
  (`git tag -d vX.Y.Z && git push --delete origin vX.Y.Z`).
- **npm:** `npm unpublish @mynextadventure/cli@X.Y.Z` works only within
  72 hours of publish. After that, publish a new patch version with the
  fix. **Never** reuse a version number.
- **Homebrew:** revert the formula commit in the tap repo.
