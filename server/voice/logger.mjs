import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const logDir = join(process.cwd(), "logs");
mkdirSync(logDir, { recursive: true });
const sessionId = new Date().toISOString().replaceAll(/[:.]/g, "-");
const sessionLogPath = join(logDir, `voice-${sessionId}.log`);

function normalizeError(error) {
	if (error instanceof Error)
		return {
			error_name: error.name,
			error_message: error.message,
			error_stack: error.stack,
		};
	return { error_message: String(error) };
}

function writeRecord(record) {
	const logRecord = {
		ts: new Date().toISOString(),
		level: record.level ?? "info",
		session_id: sessionId,
		service: "voice-server",
		pid: process.pid,
		...record,
	};
	const line = JSON.stringify(logRecord);
	console.log(line);
	appendFileSync(sessionLogPath, `${line}\n`);
}

export function log(scope, message, fields = {}) {
	writeRecord({
		level: "info",
		event: "runtime_log",
		scope,
		message,
		...fields,
	});
}

export function logError(scope, message, error, fields = {}) {
	writeRecord({
		level: "error",
		event: "runtime_error",
		scope,
		message,
		...normalizeError(error),
		...fields,
	});
}

export function logEvent(record) {
	writeRecord(record);
}

export function logChildLines(scope, chunk, shouldLog = () => true) {
	const lines = chunk.toString().trim().split("\n").filter(Boolean);
	for (const line of lines) {
		if (shouldLog(line))
			log(scope, line, {
				event: "child_process_log",
				child_scope: scope,
			});
	}
}
