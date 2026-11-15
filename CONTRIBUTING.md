# Contributing to Sekaerth

Sekaerth is developed by **SekaFaji Games**. Contributions and issue reports are welcome.

## Local setup

Use Node.js 22 or later.

```sh
npm install
npm run dev
```

Before requesting a merge, run `npm run check` (unit tests, TypeScript and production build).

## Changes

- Make focused changes on a branch and open a pull request to `main`.
- Keep world generation deterministic for a given seed, and avoid altering existing world saves without a documented migration.
- Add or update tests for item, crafting, climate, chunk and save-data changes.
- Keep gameplay rules separate from screen rendering, audio and browser storage.
- Don't commit generated build directories, large backup archives, credentials or personal browser saves.
- Document controls or world format changes in the README and relevant `docs/` file.

## Current architectural boundaries

See [architecture](docs/ARCHITECTURE.md). `src/SekaerthGame.tsx` still coordinates the main loop and screen states; these will be extracted incrementally, with tests, rather than rewritten in one change.

## Bug reports

Please include the device, browser, steps to reproduce and expected versus actual behavior. For save issues, do not publish private browser storage or save exports in public issues.
