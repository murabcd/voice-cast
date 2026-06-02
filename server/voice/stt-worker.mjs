import { spawn } from "node:child_process";
import { requireFile, requireFiles } from "./assertions.mjs";
import { log, logChildLines } from "./logger.mjs";

export class SttWorker {
	constructor({ bin, modelDir, requiredFiles, onEvent, onExit }) {
		requireFile(
			bin,
			"Rust STT worker binary is missing; build with cargo build --release --manifest-path native/voice-stt-worker/Cargo.toml",
		);
		requireFiles(modelDir, requiredFiles, "Rust STT model file is missing");
		this.onEvent = onEvent;
		this.onExit = onExit;
		this.stdout = "";
		this.stopped = false;
		this.stdinClosed = false;
		this.proc = spawn(bin, [modelDir], { stdio: ["pipe", "pipe", "pipe"] });
		this.proc.stdout.on("data", (chunk) => this.handleStdout(chunk));
		this.proc.stderr.on("data", (chunk) => logChildLines("stt", chunk));
		this.proc.stdin.on("error", (error) => {
			this.stdinClosed = true;
			if (error.code === "EPIPE" || this.stopped || this.proc.killed) return;
			log("stt", `worker stdin error: ${error.message}`);
			this.onEvent({ type: "error", message: error.message });
		});
		this.proc.stdin.on("close", () => {
			this.stdinClosed = true;
		});
		this.proc.on("error", (error) => {
			log("stt", `worker error: ${error.message}`);
			this.onEvent({ type: "error", message: error.message });
		});
		this.proc.on("exit", (code, signal) => {
			log(
				"stt",
				`worker exited code=${code ?? "none"} signal=${signal ?? "none"}`,
			);
			this.onExit?.({ code, signal, stopped: this.stopped });
		});
	}

	handleStdout(chunk) {
		this.stdout += chunk.toString("utf8");
		while (true) {
			const newline = this.stdout.indexOf("\n");
			if (newline < 0) return;
			const line = this.stdout.slice(0, newline).trim();
			this.stdout = this.stdout.slice(newline + 1);
			if (!line) continue;
			try {
				this.onEvent(JSON.parse(line));
			} catch (error) {
				log("stt", `bad json ${line}: ${error.message}`);
			}
		}
	}

	pushPcm(buffer) {
		if (
			this.stdinClosed ||
			!this.proc.stdin ||
			this.proc.stdin.destroyed ||
			this.proc.killed
		)
			return false;
		const header = Buffer.allocUnsafe(4);
		header.writeUInt32LE(buffer.byteLength, 0);
		return this.proc.stdin.write(Buffer.concat([header, buffer]));
	}

	stop() {
		this.stopped = true;
		this.proc.kill();
	}
}
