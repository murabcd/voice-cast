import { SttWorker } from "./stt-worker.mjs";

export function createSttSession({
	config,
	log,
	onError,
	onEvent,
	onFinal,
	onPhase,
	onReady,
}) {
	let ready = false;
	let sessionId = 0;
	let worker = start();

	function start() {
		sessionId += 1;
		const currentSessionId = sessionId;
		ready = false;
		onPhase("warming");
		onReady(false);
		return new SttWorker({
			...config,
			onEvent: (event) => {
				if (currentSessionId !== sessionId) return;
				onEvent(event);
				if (event.type === "ready") {
					log(
						"stt",
						`ready session=${currentSessionId} sampleRate=${event.sampleRate} vadChunkMs=${event.vadChunkMs}`,
					);
					ready = true;
					onReady(true);
					onPhase("hearing");
				}
				if (event.type === "error") onError(event.message);
				if (event.type === "final" && event.text?.trim())
					onFinal(event.text.trim());
			},
			onExit: ({ stopped }) => {
				if (currentSessionId === sessionId && !stopped)
					onError("STT worker exited");
			},
		});
	}

	return {
		pushPcm(data) {
			if (!ready) return true;
			return worker.pushPcm(Buffer.isBuffer(data) ? data : Buffer.from(data));
		},
		restart(reason) {
			log("stt", `restart reason=${reason}`);
			worker.stop();
			worker = start();
		},
		stop() {
			worker.stop();
		},
	};
}
