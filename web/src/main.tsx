import React from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { characters, languages } from "./app-data";
import type { Phase, Screen, SettingsAction, SettingsState } from "./app-types";
import { PickScreen, SettingsDialog, WelcomeScreen } from "./app-ui";
import "./styles.css";

const defaultPrompt =
	"Ты локальный голосовой ассистент для живого разговора. Отвечай на выбранном языке. Отвечай естественно, кратко и по делу. Если фраза пользователя распознана неполно, уточни, что именно он имел в виду. Формулируй ответы так, чтобы они звучали естественно при синтезе речи: используй обычную пунктуацию и избегай латиницы там, где можно сказать на выбранном языке.";
const selectedCharacterKey = "cartoon-voice:selected-character";
const selectedLanguageKey = "cartoon-voice:selected-language";

interface ViewState {
	canScrollLeft: boolean;
	canScrollRight: boolean;
	previewAnimation: boolean;
	screen: Screen;
	selectedId: number;
}

function settingsReducer(
	state: SettingsState,
	action: SettingsAction,
): SettingsState {
	switch (action.type) {
		case "setOpen":
			return { ...state, open: action.value };
		case "setSystemPrompt":
			return { ...state, systemPrompt: action.value };
		case "setLanguageCode":
			return { ...state, languageCode: action.value };
		case "setMaxTokens":
			return { ...state, maxTokens: action.value };
		case "setTemperature":
			return { ...state, temperature: action.value };
		case "setTopP":
			return { ...state, topP: action.value };
		case "setRepeatPenalty":
			return { ...state, repeatPenalty: action.value };
		case "setAdvancedOpen":
			return { ...state, advancedOpen: action.value };
	}
}

function viewReducer(state: ViewState, patch: Partial<ViewState>): ViewState {
	return { ...state, ...patch };
}

function getInitialSelectedId() {
	const fallback = characters[0]?.id ?? 1;
	try {
		const stored = Number(localStorage.getItem(selectedCharacterKey));
		return characters.some((character) => character.id === stored)
			? stored
			: fallback;
	} catch {
		return fallback;
	}
}

function getInitialLanguage() {
	try {
		const stored = localStorage.getItem(selectedLanguageKey);
		return languages.some((language) => language.code === stored)
			? (stored ?? "ru")
			: "ru";
	} catch {
		return "ru";
	}
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

function cancelAnimationFrameRef(ref: React.RefObject<number>) {
	const frame = ref.current;
	if (!frame) return;
	cancelAnimationFrame(frame);
	ref.current = 0;
}

function App() {
	const [view, setView] = React.useReducer(viewReducer, {
		canScrollLeft: false,
		canScrollRight: false,
		previewAnimation: false,
		screen: "welcome",
		selectedId: getInitialSelectedId(),
	});
	const [phase, setPhase] = React.useState<Phase>("idle");
	const [settings, dispatchSettings] = React.useReducer(settingsReducer, {
		open: false,
		systemPrompt: defaultPrompt,
		languageCode: getInitialLanguage(),
		maxTokens: "512",
		temperature: "0.35",
		topP: "0.9",
		repeatPenalty: "1.05",
		advancedOpen: false,
	});
	const [active, setActive] = React.useState(false);
	const [jawOpen, setJawOpen] = React.useState(0);

	const selected =
		characters.find((character) => character.id === view.selectedId) ??
		characters[0];
	const selectedLanguage =
		languages.find((language) => language.code === settings.languageCode) ??
		languages[0];
	const selectedCharacterPrompt =
		settings.languageCode === "ru" ? selected.prompts.ru : selected.prompts.en;
	const scrollRef = React.useRef<HTMLDivElement>(null);
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
	const scrollRafRef = React.useRef(0);
	const updateScrollButtonsRef = React.useRef<() => void>(() => undefined);

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
			} catch {
				// Already stopped.
			}
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
			const target = Math.min(1, Math.max(0, (rms - 0.01) * 7.5));
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
			serverPhaseRef.current = "idle";
			setPhase("idle");
		},
		[stopPlayback],
	);

	const handleMicAudio = React.useCallback(
		(event: AudioProcessingEvent) => {
			const ws = wsRef.current;
			const micContext = micContextRef.current;
			if (!ws || ws.readyState !== WebSocket.OPEN || !micContext) return;
			const input = new Float32Array(event.inputBuffer.getChannelData(0));
			let sum = 0;
			for (const sample of input) sum += sample * sample;
			const rms = Math.sqrt(sum / input.length);

			if (
				outputActiveRef.current ||
				serverPhaseRef.current === "speaking" ||
				serverPhaseRef.current === "thinking"
			) {
				if (rms > 0.025) {
					bargeFramesRef.current += 1;
					if (bargeFramesRef.current >= 4) {
						ws.send(JSON.stringify({ type: "barge_in" }));
						void stopPlayback();
						bargeFramesRef.current = 0;
					}
				} else {
					bargeFramesRef.current = Math.max(0, bargeFramesRef.current - 1);
				}
			}

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
				if (kind === 1) {
					const sampleRate = new DataView(
						payload.buffer,
						payload.byteOffset,
						payload.byteLength,
					).getUint32(0, true);
					playbackContextRef.current =
						playbackContextRef.current || new AudioContext({ sampleRate });
					outputActiveRef.current = true;
					setPhase("speaking");
				} else if (kind === 2) {
					await playPcm(
						payload,
						playbackContextRef.current?.sampleRate || 24000,
					);
				}
				return;
			}

			const msg = JSON.parse(event.data);
			if (msg.type === "state") {
				serverPhaseRef.current = msg.phase;
				setPhase(
					outputActiveRef.current && msg.phase === "hearing"
						? "speaking"
						: msg.phase,
				);
			}
			if (msg.type === "done") {
				serverPhaseRef.current = "hearing";
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
		ws.onopen = async () => {
			ws.send(
				JSON.stringify({
					type: "settings",
					systemPrompt: `${settings.systemPrompt}\n\nConversation language: ${selectedLanguage.name}. Reply only in ${selectedLanguage.name}.\n\nCharacter voice: ${selectedCharacterPrompt}`,
					language: selectedLanguage.code,
					maxTokens: settings.maxTokens,
					temperature: settings.temperature,
					topP: settings.topP,
					repeatPenalty: settings.repeatPenalty,
				}),
			);
			serverPhaseRef.current = "hearing";
			setPhase("hearing");
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
		settings.maxTokens,
		settings.repeatPenalty,
		settings.systemPrompt,
		settings.temperature,
		settings.topP,
		stopChat,
	]);

	React.useEffect(() => () => void stopChat(), [stopChat]);

	React.useEffect(() => {
		try {
			localStorage.setItem(selectedCharacterKey, String(view.selectedId));
		} catch {
			// Persistence is optional.
		}
	}, [view.selectedId]);

	React.useEffect(() => {
		try {
			localStorage.setItem(selectedLanguageKey, settings.languageCode);
		} catch {
			// Persistence is optional.
		}
	}, [settings.languageCode]);

	React.useEffect(() => {
		if (!view.previewAnimation) return;
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
	}, [view.previewAnimation]);

	const updateScrollButtons = React.useCallback(() => {
		if (scrollRafRef.current) return;
		scrollRafRef.current = requestAnimationFrame(() => {
			scrollRafRef.current = 0;
			const el = scrollRef.current;
			if (!el) return;
			const nextCanScrollLeft = el.scrollLeft > 10;
			const nextCanScrollRight =
				el.scrollLeft < el.scrollWidth - el.clientWidth - 10;
			if (
				view.canScrollLeft !== nextCanScrollLeft ||
				view.canScrollRight !== nextCanScrollRight
			) {
				setView({
					canScrollLeft: nextCanScrollLeft,
					canScrollRight: nextCanScrollRight,
				});
			}
		});
	}, [view.canScrollLeft, view.canScrollRight]);
	updateScrollButtonsRef.current = updateScrollButtons;

	React.useEffect(() => {
		if (view.screen !== "pick") return;
		const handleResize = () => updateScrollButtonsRef.current();
		handleResize();
		window.addEventListener("resize", handleResize);
		return () => {
			window.removeEventListener("resize", handleResize);
			cancelAnimationFrameRef(scrollRafRef);
		};
	}, [view.screen]);

	const scroll = (direction: "left" | "right") => {
		scrollRef.current?.scrollBy({
			left: direction === "left" ? -340 : 340,
			behavior: "smooth",
		});
	};
	const avatarIsSpeaking = phase === "speaking" || view.previewAnimation;
	const selectedVoicePrompt = `Character voice: ${selectedCharacterPrompt}`;

	const handleStartStop = () => (active ? void stopChat() : void startChat());

	return (
		<main className="app-shell">
			<Button
				type="button"
				variant="ghost"
				className="brand"
				onClick={() => setView({ screen: "welcome" })}
			>
				<span>Cartoon Voice</span>
			</Button>

			{view.screen === "welcome" && (
				<WelcomeScreen
					active={active}
					avatarIsSpeaking={avatarIsSpeaking}
					jawOpen={jawOpen}
					onCharacter={() => setView({ screen: "pick" })}
					onSettings={() => dispatchSettings({ type: "setOpen", value: true })}
					onStartStop={handleStartStop}
					onTogglePreview={() =>
						setView({ previewAnimation: !view.previewAnimation })
					}
					phase={phase}
					previewAnimation={view.previewAnimation}
					selected={selected}
				/>
			)}

			{view.screen === "pick" && (
				<PickScreen
					canScrollLeft={view.canScrollLeft}
					canScrollRight={view.canScrollRight}
					onDone={() => setView({ screen: "welcome" })}
					onScroll={updateScrollButtons}
					onScrollBy={scroll}
					onSelect={(selectedId) => setView({ selectedId })}
					scrollRef={scrollRef}
					selectedId={view.selectedId}
				/>
			)}

			<SettingsDialog
				onChange={dispatchSettings}
				selected={selected}
				selectedVoicePrompt={selectedVoicePrompt}
				settings={settings}
			/>
		</main>
	);
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");
createRoot(rootElement).render(<App />);
