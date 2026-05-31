export function log(scope, message) {
	console.log(`[${new Date().toISOString()}] [${scope}] ${message}`);
}

export function logChildLines(scope, chunk, shouldLog = () => true) {
	const lines = chunk.toString().trim().split("\n").filter(Boolean);
	for (const line of lines) {
		if (shouldLog(line)) log(scope, line);
	}
}
