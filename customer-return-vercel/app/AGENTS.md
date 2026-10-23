# Customer Return - Vercel — Commercebuild custom app

Platform rules for this kind of project live in
node_modules/@commercebuild/extension/AGENTS.md — read that file first.
If node_modules is missing, run `npm install`. If the file is still missing,
the installed SDK is too old: `npm pkg set "devDependencies.@commercebuild/extension=^0.*" && npm update @commercebuild/extension`
(keeps the `^0.*` range; `npm install -D ...@latest` would pin it).
The complete `cb` API is node_modules/@commercebuild/extension/types/global.d.ts.

Commands (run in this folder): `npm install` · `npm run type-check` (after
every change) · `npm run build` · `npm run dev` · `npm run save` ·
`npm run deploy` · `npm run release`

## Project notes

App-specific rules for AI tools go here. Both the online assistant and local
tools read this section.
