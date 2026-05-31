import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const voicePort = process.env.PORT ?? "8090";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "web/src"),
		},
	},
	build: {
		outDir: "web/dist",
		emptyOutDir: true,
	},
	root: ".",
	server: {
		proxy: {
			"/voice": {
				target: `ws://127.0.0.1:${voicePort}`,
				ws: true,
			},
		},
	},
});
