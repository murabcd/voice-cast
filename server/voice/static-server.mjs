import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const types = new Map([
	[".html", "text/html; charset=utf-8"],
	[".js", "text/javascript; charset=utf-8"],
	[".css", "text/css; charset=utf-8"],
	[".svg", "image/svg+xml"],
	[".png", "image/png"],
	[".jpg", "image/jpeg"],
	[".jpeg", "image/jpeg"],
	[".otf", "font/otf"],
	[".wav", "audio/wav"],
]);

export function createStaticServer({ webDir }) {
	const distDir = normalize(join(webDir, "dist"));
	return createServer(async (req, res) => {
		const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
		const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
		const file = normalize(join(distDir, pathname));

		if (!file.startsWith(distDir)) {
			res.writeHead(403).end();
			return;
		}

		try {
			const info = await stat(file);
			if (!info.isFile()) throw new Error("not a file");
			res.writeHead(200, {
				"Content-Type": types.get(extname(file)) ?? "application/octet-stream",
			});
			createReadStream(file).pipe(res);
		} catch {
			res.writeHead(404).end("Vite build not found. Run `bun run build`.");
		}
	});
}
