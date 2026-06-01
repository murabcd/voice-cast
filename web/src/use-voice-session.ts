import React from "react";
import type {
	Character,
	LanguageOption,
	Phase,
	SettingsState,
} from "./app-types";
import { cartoonVoiceAgent } from "./voice-agent-config";
import {
	ttsFrameAudio,
	ttsFrameDone,
	ttsFrameError,
	ttsFrameStart,
} from "./voice-wire";

const bargeInFramesRequired = 6;
const bargeInRmsThreshold = 0.035;
const bargeInReleaseMs = 800;

interface UseVoiceSessionOptions {
	previewAnimation: boolean;
	selected: Character;
	selectedCharacterPrompt: string;
	selectedLanguage: LanguageOption;
	settings: SettingsState;
}

function downsampleTo16k(input: Float32Array, sampleRate: number) {
	if (sampleRate === 16000) return input;
	const ratio = sampleRate / 16000;
	const length = Math.max(1, Math.floor(input.length / ratio));
	const output = new Float32Array(length);
	for (let i = 0; i < length; i += 1) {
		const start = Math.floor(i * ratio);
		const end = Math.min(input.length, Math.floor((i + 1) * ratio));
		let sum = 0;
		for (let j = start; j < end; j += 1) sum += input[j];
		output[i] = sum / Math.max(1, end - start);
	}
	return output;
}

function floatToPcm16(samples: Float32Array) {
	const bytes = new ArrayBuffer(samples.length * 2);
	const view = new DataView(bytes);
	for (let i = 0; i < samples.length; i += 1) {
		const sample = Math.max(-1, Math.min(1, samples[i]));
		view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
	}
	return bytes;
}

function pcm16ToFloat(bytes: Uint8Array) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const out = new Float32Array(bytes.byteLength / 2);
	for (let i = 0; i < out.length; i += 1)
		out[i] = view.getInt16(i * 2, true) / 0x8000;
	return out;
}

function getPlaybackSources(
	ref: React.RefObject<Set<AudioBufferSourceNode> | null>,
) {
	if (!ref.current) ref.current = new Set<AudioBufferSourceNode>();
	return ref.current;
}

export function useVoiceSession({
	previewAnimation,
	selected,
	selectedCharacterPrompt,
	selectedLanguage,
	settings,
}: UseVoiceSessionOptions) {
	const [phase, setPhase] = React.useState<Phase>("idle");
	const [active, setActive] = React.useState(false);
	const [jawOpen, setJawOpen] = React.useState(0);
	const [webSearchActive, setWebSearchActive] = React.useState(false);
	const sttReadyRef = React.useRef(false);
	const wsRef = React.useRef<WebSocket | null>(null);
	const micStreamRef = React.useRef<MediaStream | null>(null);
	const micContextRef = React.useRef<AudioContext | null>(null);
	const processorRef = React.useRef<ScriptProcessorNode | null>(null);
	const playbackContextRef = React.useRef<AudioContext | null>(null);
	const playbackCursorRef = React.useRef(0);
	const playbackSourcesRef = React.useRef<Set<AudioBufferSourceNode> | null>(
		null,
	);
	const playbackAnalyserRef = React.useRef<AnalyserNode | null>(null);
	const jawRafRef = React.useRef(0);
	const jawOpenRef = React.useRef(0);
	const outputActiveRef = React.useRef(false);
	const serverPhaseRef = React.useRef<Phase>("idle");
	const bargeFramesRef = React.useRef(0);
	const bargeInSentRef = React.useRef(false);
	const bargeInReleasedUntilRef = React.useRef(0);

	const stopPlayback = React.useCallback(async () => {
		outputActiveRef.current = false;
		if (jawRafRef.current) {
			cancelAnimationFrame(jawRafRef.current);
			jawRafRef.current = 0;
		}
		playbackAnalyserRef.current = null;
		jawOpenRef.current = 0;
		setJawOpen(0);
		const playbackSources = getPlaybackSources(playbackSourcesRef);
		for (const source of playbackSources) {
			try {
				source.stop();
			} catch {}
		}
		playbackSources.clear();
		playbackCursorRef.current = 0;
		if (
			playbackContextRef.current &&
			playbackContextRef.current.state !== "closed"
		) {
			await playbackContextRef.current.close().catch(() => undefined);
		}
		playbackContextRef.current = null;
	}, []);

	const startJawMeter = React.useCallback(() => {
		if (jawRafRef.current) return;
		const tick = () => {
			const analyser = playbackAnalyserRef.current;
			if (!outputActiveRef.current || !analyser) {
				jawRafRef.current = 0;
				jawOpenRef.current *= 0.65;
				setJawOpen(jawOpenRef.current < 0.02 ? 0 : jawOpenRef.current);
				return;
			}

			const samples = new Uint8Array(analyser.fftSize);
			analyser.getByteTimeDomainData(samples);
			let sum = 0;
			for (const sample of samples) {
				const centered = (sample - 128) / 128;
				sum += centered * centered;
			}
			const rms = Math.sqrt(sum / samples.length);
			const fallback =
				serverPhaseRef.current === "speaking"
					? 0.08 + Math.sin(performance.now() / 58) * 0.035
					: 0;
			const target = Math.max(
				fallback,
				Math.min(1, Math.max(0, (rms - 0.003) * 18)),
			);
			jawOpenRef.current = jawOpenRef.current * 0.54 + target * 0.46;
			setJawOpen(jawOpenRef.current);
			jawRafRef.current = requestAnimationFrame(tick);
		};
		jawRafRef.current = requestAnimationFrame(tick);
	}, []);

	const playPcm = React.useCallback(
		async (bytes: Uint8Array, sampleRate: number) => {
			outputActiveRef.current = true;
			setPhase("speaking");
			if (
				!playbackContextRef.current ||
				playbackContextRef.current.state === "closed"
			) {
				playbackContextRef.current = new AudioContext({ sampleRate });
				playbackCursorRef.current =
					playbackContextRef.current.currentTime + 0.03;
			}
			if (!playbackAnalyserRef.current) {
				playbackAnalyserRef.current =
					playbackContextRef.current.createAnalyser();
				playbackAnalyserRef.current.fftSize = 512;
				playbackAnalyserRef.current.smoothingTimeConstant = 0.24;
				playbackAnalyserRef.current.connect(
					playbackContextRef.current.destination,
				);
			}
			if (playbackContextRef.current.state === "suspended")
				await playbackContextRef.current.resume();
			const samples = pcm16ToFloat(bytes);
			const buffer = playbackContextRef.current.createBuffer(
				1,
				samples.length,
				sampleRate,
			);
			buffer.copyToChannel(samples, 0);
			const source = playbackContextRef.current.createBufferSource();
			source.buffer = buffer;
			source.connect(playbackAnalyserRef.current);
			const playbackSources = getPlaybackSources(playbackSourcesRef);
			playbackSources.add(source);
			startJawMeter();
			source.onended = () => {
				playbackSources.delete(source);
				if (playbackSources.size === 0) {
					outputActiveRef.current = false;
					jawOpenRef.current = 0;
					setJawOpen(0);
					setPhase(
						serverPhaseRef.current === "thinking" ? "thinking" : "hearing",
					);
				}
			};
			const startAt = Math.max(
				playbackCursorRef.current,
				playbackContextRef.current.currentTime + 0.01,
			);
			source.start(startAt);
			playbackCursorRef.current = startAt + buffer.duration;
		},
		[startJawMeter],
	);

	const stopChat = React.useCallback(
		async (closeSocket = true) => {
			setActive(false);
			processorRef.current?.disconnect();
			micStreamRef.current?.getTracks().forEach((track) => {
				track.stop();
			});
			if (micContextRef.current && micContextRef.current.state !== "closed")
				await micContextRef.current.close().catch(() => undefined);
			if (closeSocket) wsRef.current?.close();
			processorRef.current = null;
			micStreamRef.current = null;
			micContextRef.current = null;
			await stopPlayback();
			setWebSearchActive(false);
			sttReadyRef.current = false;
			serverPhaseRef.current = "idle";
			bargeFramesRef.current = 0;
			bargeInSentRef.current = false;
			bargeInReleasedUntilRef.current = 0;
			setPhase("idle");
		},
		[stopPlayback],
	);

	const handleMicAudio = React.useCallback(
		(event: AudioProcessingEvent) => {
			const ws = wsRef.current;
			const micContext = micContextRef.current;
			if (
				!ws ||
				ws.readyState !== WebSocket.OPEN ||
				!micContext ||
				!sttReadyRef.current
			)
				return;
			const input = new Float32Array(event.inputBuffer.getChannelData(0));
			let sum = 0;
			for (const sample of input) sum += sample * sample;
			const rms = Math.sqrt(sum / input.length);
			const assistantActive =
				outputActiveRef.current ||
				serverPhaseRef.current === "speaking" ||
				serverPhaseRef.current === "thinking";

			if (assistantActive) {
				if (rms > bargeInRmsThreshold) {
					bargeFramesRef.current += 1;
					if (
						!bargeInSentRef.current &&
						bargeFramesRef.current >= bargeInFramesRequired
					) {
						bargeInSentRef.current = true;
						bargeInReleasedUntilRef.current =
							performance.now() + bargeInReleaseMs;
						ws.send(JSON.stringify({ type: "barge_in" }));
						void stopPlayback();
					}
				} else {
					bargeFramesRef.current = Math.max(0, bargeFramesRef.current - 1);
				}
				if (!bargeInSentRef.current) return;
			}

			if (performance.now() < bargeInReleasedUntilRef.current) return;
			ws.send(floatToPcm16(downsampleTo16k(input, micContext.sampleRate)));
		},
		[stopPlayback],
	);

	const handleServerMessage = React.useCallback(
		async (event: MessageEvent) => {
			if (event.data instanceof ArrayBuffer) {
				const bytes = new Uint8Array(event.data);
				const kind = bytes[0];
				const payload = bytes.subarray(1);
				if (kind === ttsFrameStart) {
					const sampleRate = new DataView(
						payload.buffer,
						payload.byteOffset,
						payload.byteLength,
					).getUint32(0, true);
					playbackContextRef.current =
						playbackContextRef.current || new AudioContext({ sampleRate });
					outputActiveRef.current = true;
					setPhase("speaking");
				} else if (kind === ttsFrameAudio) {
					await playPcm(
						payload,
						playbackContextRef.current?.sampleRate || 24000,
					);
				} else if (kind === ttsFrameDone) {
					if (!outputActiveRef.current && serverPhaseRef.current !== "thinking")
						setPhase("hearing");
				} else if (kind === ttsFrameError) {
					const message = new TextDecoder().decode(payload);
					console.error(message);
					outputActiveRef.current = false;
					setPhase("hearing");
				}
				return;
			}

			const msg = JSON.parse(event.data);
			if (msg.type === "web_search") {
				setWebSearchActive(Boolean(msg.active));
			}
			if (msg.type === "stt_ready") {
				sttReadyRef.current = Boolean(msg.ready);
				if (!msg.ready && serverPhaseRef.current === "hearing") {
					serverPhaseRef.current = "warming";
					setPhase("warming");
				}
			}
			if (msg.type === "state") {
				serverPhaseRef.current = msg.phase;
				if (msg.phase === "thinking" || msg.phase === "speaking") {
					bargeFramesRef.current = 0;
					bargeInSentRef.current = false;
					bargeInReleasedUntilRef.current = 0;
				}
				setPhase(
					outputActiveRef.current && msg.phase === "hearing"
						? "speaking"
						: msg.phase,
				);
			}
			if (msg.type === "turn_done") {
				setWebSearchActive(false);
				serverPhaseRef.current = "hearing";
				bargeFramesRef.current = 0;
				bargeInSentRef.current = false;
				bargeInReleasedUntilRef.current = 0;
				if (!outputActiveRef.current) setPhase("hearing");
			}
		},
		[playPcm],
	);

	const startChat = React.useCallback(async () => {
		setActive(true);
		const protocol = location.protocol === "https:" ? "wss" : "ws";
		const ws = new WebSocket(`${protocol}://${location.host}/voice`);
		ws.binaryType = "arraybuffer";
		wsRef.current = ws;
		sttReadyRef.current = false;
		serverPhaseRef.current = "warming";
		setPhase("warming");
		ws.onopen = async () => {
			ws.send(
				JSON.stringify({
					type: "settings",
					systemPrompt: cartoonVoiceAgent.buildRuntimeInstructions({
						baseInstructions: settings.systemPrompt,
						languageName: selectedLanguage.name,
						characterInstructions: selectedCharacterPrompt,
					}),
					language: selectedLanguage.code,
					voiceName: selected.voiceName,
					maxTokens: settings.maxTokens,
					temperature: settings.temperature,
					topP: settings.topP,
					repeatPenalty: settings.repeatPenalty,
					webToolsEnabled: settings.webToolsEnabled,
				}),
			);
			serverPhaseRef.current = "warming";
			bargeFramesRef.current = 0;
			bargeInSentRef.current = false;
			bargeInReleasedUntilRef.current = 0;
			setPhase("warming");
			micStreamRef.current = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
					channelCount: 1,
				},
			});
			micContextRef.current = new AudioContext();
			const source = micContextRef.current.createMediaStreamSource(
				micStreamRef.current,
			);
			processorRef.current = micContextRef.current.createScriptProcessor(
				2048,
				1,
				1,
			);
			processorRef.current.onaudioprocess = handleMicAudio;
			source.connect(processorRef.current);
			processorRef.current.connect(micContextRef.current.destination);
		};
		ws.onmessage = handleServerMessage;
		ws.onclose = () => {
			if (wsRef.current === ws) void stopChat(false);
		};
	}, [
		handleMicAudio,
		handleServerMessage,
		selectedCharacterPrompt,
		selectedLanguage.code,
		selectedLanguage.name,
		selected.voiceName,
		settings.maxTokens,
		settings.repeatPenalty,
		settings.systemPrompt,
		settings.temperature,
		settings.topP,
		settings.webToolsEnabled,
		stopChat,
	]);

	React.useEffect(() => () => void stopChat(), [stopChat]);

	React.useEffect(() => {
		if (!previewAnimation) return;
		let raf = 0;
		const startedAt = performance.now();
		const tick = (now: number) => {
			const elapsed = (now - startedAt) / 1000;
			const pulse =
				Math.max(0, Math.sin(elapsed * 12)) * 0.68 +
				Math.max(0, Math.sin(elapsed * 21)) * 0.32;
			setJawOpen(pulse);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(raf);
			setJawOpen(0);
		};
	}, [previewAnimation]);

	return {
		active,
		avatarIsSpeaking: phase === "speaking" || previewAnimation,
		handleStartStop: () => (active ? void stopChat() : void startChat()),
		jawOpen,
		phase,
		webSearchActive,
	};
}
