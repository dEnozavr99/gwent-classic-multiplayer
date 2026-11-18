import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

const LEGACY_DIR = "legacy";

/**
 * The legacy scripts are classic scripts that share globals, so they must not
 * be bundled, hashed or transformed (ADR 0002, phase 0). Vite only copies
 * classic `<script src>` files that live under `public/`, so this plugin
 * serves `legacy/` byte-for-byte in dev and emits it unchanged into the build,
 * keeping the files out of `public/`.
 */
function legacyScripts(): Plugin {
	const legacyFileNames = () => readdirSync(LEGACY_DIR).filter((f) => f.endsWith(".js"));
	const readLegacy = (name: string) => readFileSync(join(LEGACY_DIR, name));
	let base = "/";
	return {
		name: "legacy-scripts",
		configResolved(config) {
			base = config.base;
		},
		configureServer(server) {
			const prefix = `${base}${LEGACY_DIR}/`;
			server.middlewares.use((req, res, next) => {
				const urlPath = (req.url ?? "").split("?")[0] ?? "";
				if (!urlPath.startsWith(prefix)) return next();
				const name = urlPath.slice(prefix.length);
				if (!legacyFileNames().includes(name)) return next();
				res.setHeader("Content-Type", "text/javascript");
				res.setHeader("Cache-Control", "no-cache");
				res.end(readLegacy(name));
			});
		},
		generateBundle() {
			for (const name of legacyFileNames()) {
				this.emitFile({
					type: "asset",
					fileName: `${LEGACY_DIR}/${name}`,
					source: readLegacy(name),
				});
			}
		},
	};
}

export default defineConfig({
	// GitHub Pages project path.
	base: "/gwent-classic-multiplayer/",
	plugins: [legacyScripts()],
});
