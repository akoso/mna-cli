/**
 * Text imports (`import md from './x.md' with { type: 'text' }`) are bundled
 * inline by Bun, which is how the skill payload travels inside `dist/mna.js`
 * and the compiled binaries. TypeScript needs the shape declared.
 */
declare module '*.md' {
    const content: string
    export default content
}
