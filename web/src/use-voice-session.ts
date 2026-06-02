import React from "react";
import type {
	Character,
	LanguageOption,
	Phase,
	SettingsState,
} from "./app-types";
import { createBargeInDetector } from "./barge-in-detector";
import { useAvatarAnimation } from "./use-avatar-animation";
import { castAgent } from "./voice-agent-config";
import {
	downsampleTo16k,
	floatToPcm16,
	pcm16ToFloat,
} from "./voice-audio-codec";
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
	const [webSearchActive, setWebSearchActive] = React.useState(false);
	const [playbackAnalyser, setPlaybackAnalyser] =
		React.useState<AnalyserNode | null>(null);
	const {
		avatarIsListening,
		avatarIsSpeaking,
		jawOpen,
		listeningEnergy,
		updateListeningMeter,
	} = useAvatarAnimation({ phase, playbackAnalyser, previewAnimation });
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
	const outputActiveRef = React.useRef(false);
	const serverPhaseRef = React.useRef<Phase>("idle");
	const bargeInRef = React.useRef<ReturnType<
		typeof createBargeInDetector
	> | null>(null);
	if (bargeInRef.current === null) {
		bargeInRef.current = createBargeInDetector({
			framesRequired: bargeInFramesRequired,
			releaseMs: bargeInReleaseMs,
			rmsThreshold: bargeInRmsThreshold,
		});
	}
	const bargeInDetector = bargeInRef.current;

	const stopPlayback = React.useCallback(async () => {
		outputActiveRef.current = false;
		setPlaybackAnalyser(null);
		playbackAnalyserRef.current = null;
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
				setPlaybackAnalyser(playbackAnalyserRef.current);
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
			source.onended = () => {
				playbackSources.delete(source);
				if (playbackSources.size === 0) {
					outputActiveRef.current = false;
					setPlaybackAnalyser(null);
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
		[],
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
			bargeInDetector.reset();
			setPhase("idle");
		},
		[bargeInDetector, stopPlayback],
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
			updateListeningMeter(rms);
			const assistantActive =
				outputActiveRef.current ||
				serverPhaseRef.current === "speaking" ||
				serverPhaseRef.current === "thinking";
			const bargeIn = bargeInDetector.evaluate({ assistantActive, rms });
			if (bargeIn.shouldSendBargeIn) {
				ws.send(JSON.stringify({ type: "barge_in" }));
				void stopPlayback();
			}
			if (!bargeIn.allowMicFrame) return;
			ws.send(floatToPcm16(downsampleTo16k(input, micContext.sampleRate)));
		},
		[bargeInDetector, stopPlayback, updateListeningMeter],
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
					setPlaybackAnalyser(null);
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
					bargeInDetector.reset();
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
				bargeInDetector.reset();
				if (!outputActiveRef.current) setPhase("hearing");
			}
		},
		[bargeInDetector, playPcm],
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
					systemPrompt: castAgent.buildRuntimeInstructions({
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
			bargeInDetector.reset();
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
		bargeInDetector,
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

	return {
		active,
		avatarIsListening,
		avatarIsSpeaking,
		handleStartStop: () => (active ? void stopChat() : void startChat()),
		jawOpen,
		listeningEnergy,
		phase,
		webSearchActive,
	};
}
