import { mkdirSync } from "node:fs";
import { join } from "node:path";
import pino from "pino";

const sessionId = new Date().toISOString().replaceAll(/[:.]/g, "-");
const configuredLogDir = process.env.VOICE_LOG_DIR?.trim();
const sessionLogPath = configuredLogDir
	? join(configuredLogDir, `voice-${sessionId}.log`)
	: undefined;
const base = {
	pid: process.pid,
	session_id: sessionId,
	service: "voice-server",
};
const pinoOptions = {
	base,
	formatters: {
		level: (label) => ({ level: label }),
	},
	messageKey: "message",
	timestamp: () => `,"ts":"${new Date().toISOString()}"`,
};

const stdoutStream = pino.destination({ dest: 1, sync: false });
const streams = [{ level: "trace", stream: stdoutStream }];
let fileStream;
if (sessionLogPath) {
	mkdirSync(configuredLogDir, { recursive: true });
	fileStream = pino.destination({
		dest: sessionLogPath,
		mkdir: true,
		sync: false,
	});
	streams.push({ level: "trace", stream: fileStream });
}
const logger = pino(pinoOptions, pino.multistream(streams));

stdoutStream.on("error", (error) => {
	if (fileStream) {
		fileStream.write(
			`${JSON.stringify({
				level: "warn",
				ts: new Date().toISOString(),
				...base,
				event: "stdout_error",
				error_code: error?.code,
				error_message: error?.message,
				message: "stdout logging failed",
			})}\n`,
		);
	}
});

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
	const { level = "info", message, ...fields } = record;
	logger[level](fields, message);
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
