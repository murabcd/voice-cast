import { existsSync } from "node:fs";
import { join } from "node:path";

export function requireFile(path, hint) {
	if (!existsSync(path)) throw new Error(`${hint}: ${path}`);
}

export function requireFiles(dir, files, hint) {
	for (const file of files) {
		requireFile(join(dir, file), hint);
	}
}
