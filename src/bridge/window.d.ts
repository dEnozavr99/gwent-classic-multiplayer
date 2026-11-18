/**
 * Typed bridge to the legacy classic scripts (`legacy/*.js`), which are not
 * type-checked. Only the globals new code needs are declared here, and only
 * loosely: tighten a declaration when a module starts depending on it.
 *
 * Dependency direction: core <- ui <- legacy. `src/core` never touches the DOM
 * and never reads these globals; `src/ui` reaches the legacy game through them.
 */

/** A legacy object whose shape is not typed yet. */
type LegacyObject = Record<string, any>;

declare global {
	// Top-level `var` in legacy/gwent.js: also reachable as `window.<name>`.
	var ui: LegacyObject;
	var board: LegacyObject;
	var weather: LegacyObject;
	var game: LegacyObject;
	/** The Local player. */
	var player_me: LegacyObject;
	/** The Opponent. */
	var player_op: LegacyObject;

	// Top-level `let`/`const` in legacy/gwent.js: shared across classic scripts
	// as globals, but not properties of `window`.
	const eventManager: LegacyObject;
	let dm: LegacyObject;
	let userInteracted: boolean;

	/** Called by the YouTube iframe API script once it has loaded. */
	function onYouTubeIframeAPIReady(): void;
	function sleep(ms: number): Promise<void>;
	function sleepUntil(predicate: () => boolean, ms: number): Promise<void>;
}

export {};
