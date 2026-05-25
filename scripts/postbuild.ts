#!/usr/bin/env bun
/**
 * Post-build fixup for the npm-targeted bundle.
 *
 * `bun build --target=node` produces dist/mna.js with a `#!/usr/bin/env bun`
 * shebang inherited from the source entrypoint. For the npm package we need
 * `node` so users without Bun installed can still run `mna`. We also chmod
 * the file so it's executable when installed via `npm install -g`.
 */
import { readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dir, '..')
const TARGET = resolve(REPO_ROOT, 'dist/mna.js')

const original = readFileSync(TARGET, 'utf8')
const NODE_SHEBANG = '#!/usr/bin/env node\n'

// Replace any existing shebang on line 1, or prepend one if missing.
const rest = original.startsWith('#!')
    ? original.slice(original.indexOf('\n') + 1)
    : original

writeFileSync(TARGET, NODE_SHEBANG + rest, 'utf8')
chmodSync(TARGET, 0o755)

console.log(`Rewrote shebang on ${TARGET} → node`)
