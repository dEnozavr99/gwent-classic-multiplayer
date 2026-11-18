# Tooling and migration strategy: strangler around untouched legacy, Effect at the edges

The client moves from build-less vanilla JS to **Vite + TypeScript + pnpm + Biome** (Node 22.19 or newer, exact version pins) as a hard fork. Legacy files move untouched into `legacy/` and keep running as classic scripts behind one typed `window` bridge; all new alpha code is strict TypeScript in a DOM-free `src/core`, with DOM code in `src/ui` depending on core, never the reverse. Effect is adopted early but only at the edges (deck and message validation, connection errors), with Promises kept at the seams per ADR 0001. After the alpha is verified, `gwent.js` is split and converted mechanically; extracting a headless rules engine stays deferred to the server upgrade.

## Consequences

- **Phases with gates**: tooling, regression net, core groundwork, `Controller` seam and loopback, menu/Room/transport, then alpha verification and the split-and-convert. No phase starts until the previous gate is green.
- **Regression net ("touch it, test it first")**: Vitest for new modules; Playwright characterization scenarios written against a `Driver` interface (the same suite later serves as the conformance suite for a server engine); invariant-based smoke runs rather than exact traces, because the RNG split legitimately changes any golden master; and a required timing-independence test (the same scripted Game at different clock speeds must give identical state-hash traces) that gates every concurrent `Promise.all` site.
- **Effect**: Effect v4 core is stable but `schema` is still tagged unstable, so versions are pinned exactly and Schema stays behind our own `parseDeck` and `decodeMessage` functions. Converted legacy modules may use Effect when touched; the rules core is a candidate only at the server port.
- **Formatting**: Biome covers `src/`, `tests/` and config files. `legacy/`, `index.html` and `style.css` are excluded so no line is reformatted and `git blame` survives; legacy files are formatted when they convert, in format-only commits listed in `.git-blame-ignore-revs`.
- **Dropped**: opening `index.html` from disk. The hosted site is the product; developers use the dev server.
- **Spike risks for phase 0**: Vite's handling of classic scripts, asset paths and the YouTube global callback; whether Playwright's fake clock is fast enough for the legacy `sleep`s; Biome's config keys at the pinned version.

## Considered options

- **Big-bang conversion to ES modules**: rejected. It means splitting `gwent.js`'s 57 top-level declarations, untangling circular class dependencies and re-pointing inline `onclick` handlers before any multiplayer work, for no gain to the alpha.
- **Bare `esbuild` or `tsc` plus a hand-rolled bundler**: rejected. More wiring than Vite for the same result, and no Vitest pairing.
- **Effect only at the server stage**: rejected in favour of gradual adoption at the edges, since the client already needs a build step and the edges are where validation and typed errors pay off first.
