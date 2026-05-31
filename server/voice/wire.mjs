export const ttsFrameStart = 1;
export const ttsFrameAudio = 2;
export const ttsFrameDone = 3;
export const ttsFrameError = 4;

export function sendJson(ws, value) {
	if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(value));
}

export function sendBinary(ws, kind, payload = Buffer.alloc(0)) {
	if (ws.readyState !== ws.OPEN) return;
	ws.send(Buffer.concat([Buffer.from([kind]), Buffer.from(payload)]));
}

export function sampleRatePayload(sampleRate) {
	const payload = Buffer.allocUnsafe(4);
	payload.writeUInt32LE(sampleRate, 0);
	return payload;
}
