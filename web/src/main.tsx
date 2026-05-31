import {
	ArrowRight,
	Check,
	ChevronLeft,
	ChevronRight,
	MicOff,
	Play,
	Volume2,
	Waves,
} from "lucide-react";
import React from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import "./styles.css";

type Phase = "idle" | "hearing" | "thinking" | "speaking";
type Screen = "welcome" | "pick";

interface Character {
	id: number;
	name: string;
	image: string;
	prompt: string;
}

const characters: Character[] = [
	{
		id: 1,
		name: "Firefighter",
		image:
			"https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/firefighter-16x9.png",
		prompt:
			"Ты говоришь как добрый мультяшный пожарный: спокойно, уверенно и с короткими практичными ответами.",
	},
	{
		id: 2,
		name: "Vampire Girl",
		image:
			"https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/vampire-girl-16x9.png",
		prompt:
			"Ты говоришь как дружелюбная мультяшная вампирша: чуть загадочно, но понятно и по делу.",
	},
	{
		id: 3,
		name: "Disco Robot",
		image:
			"https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/disco-robot-16x9.png",
		prompt:
			"Ты говоришь как веселый диско-робот: энергично, лаконично, с ясной структурой.",
	},
	{
		id: 4,
		name: "Alien Chef",
		image:
			"https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/alien-chef-16x9.png",
		prompt:
			"Ты говоришь как мультяшный инопланетный шеф: тепло, образно, но без длинных монологов.",
	},
	{
		id: 5,
		name: "Hacker Grandma",
		image:
			"https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/hacker-grandma-16x9.png",
		prompt:
			"Ты говоришь как мультяшная хакер-бабушка: умно, тепло, с короткими ясными советами.",
	},
	{
		id: 6,
		name: "Grumpy Wizard",
		image:
			"https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/grumpy-wizard-16x9.png",
		prompt:
			"Ты говоришь как ворчливый, но добрый волшебник: с характером, но полезно и понятно.",
	},
	{
		id: 7,
		name: "Knight Princess",
		image:
			"https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/knight-princess-16x9.png",
		prompt:
			"Ты говоришь как храбрая мультяшная принцесса-рыцарь: уверенно, заботливо и кратко.",
	},
	{
		id: 8,
		name: "Space Pirate",
		image:
			"https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/space-pirate-16x9.png",
		prompt:
			"Ты говоришь как космический пират: живо, дерзко, но дружелюбно и по-русски.",
	},
	{
		id: 9,
		name: "Wise King",
		image:
			"https://7zjbnnvanyvles15.public.blob.vercel-storage.com/default-characters/wise-king-16x9.png",
		prompt:
			"Ты говоришь как мудрый мультяшный король: спокойно, точно, без лишней церемонии.",
	},
];

const defaultPrompt =
	"Ты локальный русскоязычный голосовой ассистент для живого разговора. Отвечай только на русском языке. Отвечай естественно и по делу. Если фраза пользователя распознана неполно, уточни, что именно он имел в виду. Пиши текст удобно для синтеза речи: естественная пунктуация, без латиницы там, где можно сказать по-русски.";

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

function App() {
	const [screen, setScreen] = React.useState<Screen>("welcome");
	const [selectedId, setSelectedId] = React.useState(1);
	const [phase, setPhase] = React.useState<Phase>("idle");
	const [settingsOpen, setSettingsOpen] = React.useState(false);
	const [systemPrompt, setSystemPrompt] = React.useState(defaultPrompt);
	const [maxTokens, setMaxTokens] = React.useState("");
	const [active, setActive] = React.useState(false);
	const [canScrollLeft, setCanScrollLeft] = React.useState(false);
	const [canScrollRight, setCanScrollRight] = React.useState(false);

	const selected =
		characters.find((character) => character.id === selectedId) ??
		characters[0];
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const wsRef = React.useRef<WebSocket | null>(null);
	const micStreamRef = React.useRef<MediaStream | null>(null);
	const micContextRef = React.useRef<AudioContext | null>(null);
	const processorRef = React.useRef<ScriptProcessorNode | null>(null);
	const playbackContextRef = React.useRef<AudioContext | null>(null);
	const playbackCursorRef = React.useRef(0);
	const playbackSourcesRef = React.useRef(new Set<AudioBufferSourceNode>());
	const outputActiveRef = React.useRef(false);
	const serverPhaseRef = React.useRef<Phase>("idle");
	const bargeFramesRef = React.useRef(0);
	const scrollRafRef = React.useRef(0);

	const stopPlayback = React.useCallback(async () => {
		outputActiveRef.current = false;
		for (const source of playbackSourcesRef.current) {
			try {
				source.stop();
			} catch {
				// Already stopped.
			}
		}
		playbackSourcesRef.current.clear();
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
			source.connect(playbackContextRef.current.destination);
			playbackSourcesRef.current.add(source);
			source.onended = () => {
				playbackSourcesRef.current.delete(source);
				if (playbackSourcesRef.current.size === 0) {
					outputActiveRef.current = false;
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
					systemPrompt: `${systemPrompt}\n\nCharacter voice: ${selected.prompt}`,
					maxTokens,
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
		maxTokens,
		selected.prompt,
		stopChat,
		systemPrompt,
	]);

	React.useEffect(() => () => void stopChat(), [stopChat]);

	const updateScrollButtons = React.useCallback(() => {
		if (scrollRafRef.current) return;
		scrollRafRef.current = requestAnimationFrame(() => {
			scrollRafRef.current = 0;
			const el = scrollRef.current;
			if (!el) return;
			const nextCanScrollLeft = el.scrollLeft > 10;
			const nextCanScrollRight =
				el.scrollLeft < el.scrollWidth - el.clientWidth - 10;
			setCanScrollLeft((current) =>
				current === nextCanScrollLeft ? current : nextCanScrollLeft,
			);
			setCanScrollRight((current) =>
				current === nextCanScrollRight ? current : nextCanScrollRight,
			);
		});
	}, []);

	React.useEffect(() => {
		if (screen !== "pick") return;
		updateScrollButtons();
		window.addEventListener("resize", updateScrollButtons);
		return () => {
			window.removeEventListener("resize", updateScrollButtons);
			if (scrollRafRef.current) {
				cancelAnimationFrame(scrollRafRef.current);
				scrollRafRef.current = 0;
			}
		};
	}, [screen, updateScrollButtons]);

	const scroll = (direction: "left" | "right") => {
		scrollRef.current?.scrollBy({
			left: direction === "left" ? -340 : 340,
			behavior: "smooth",
		});
	};

	return (
		<main className="app-shell">
			<button
				type="button"
				className="brand"
				onClick={() => setScreen("welcome")}
			>
				<Waves aria-hidden="true" />
				<span>Cartoon Voice</span>
			</button>

			{screen === "welcome" && (
				<section className="welcome-screen">
					<div className="welcome-inner">
						<h1>Talk with a cartoon</h1>
						<button
							type="button"
							className={`demo-card ${active ? "is-active" : ""}`}
							onClick={() => (active ? void stopChat() : void startChat())}
							aria-label={active ? "Stop voice chat" : "Start voice chat"}
						>
							<img src={selected.image} alt="" />
							<span className="play-button">
								{active ? <MicOff /> : <Play fill="currentColor" />}
							</span>
							<span className="demo-label">
								{active ? phase : "Speak directly"}
							</span>
							<span className="avatar-badge">
								<img src={selected.image} alt="" />
								{selected.name}
							</span>
						</button>

						<ul className="steps" aria-label="Conversation steps">
							<li className="step active">
								<b>1</b>Pick a character
							</li>
							<ArrowRight aria-hidden="true" />
							<li className="step">
								<b>2</b>Start speaking
							</li>
							<ArrowRight aria-hidden="true" />
							<li className="step">
								<b>3</b>Hear the reply
							</li>
						</ul>

						<Button
							className="button button-primary primary-cta"
							onClick={() => void startChat()}
						>
							Get started
						</Button>
						<div className="secondary-actions">
							<Button
								variant="secondary"
								className="button button-secondary"
								onClick={() => setSettingsOpen(true)}
							>
								Settings
							</Button>
							<Button
								variant="secondary"
								className="button button-secondary"
								onClick={() => setScreen("pick")}
							>
								Character
							</Button>
						</div>
					</div>
				</section>
			)}

			{screen === "pick" && (
				<section className="pick-screen">
					<div className="pick-title">
						<h1>Choose a character</h1>
						<p>or keep the current voice personality</p>
					</div>
					<div className="carousel-wrap">
						{canScrollLeft && (
							<Button
								variant="ghost"
								className="button button-ghost carousel-arrow left"
								onClick={() => scroll("left")}
								aria-label="Scroll left"
							>
								<ChevronLeft />
							</Button>
						)}
						{canScrollLeft && <div className="carousel-fade left" />}
						{canScrollRight && <div className="carousel-fade right" />}
						<div
							ref={scrollRef}
							className="character-carousel"
							onScroll={updateScrollButtons}
						>
							{characters.map((character) => {
								const isSelected = selectedId === character.id;
								return (
									<button
										type="button"
										className="character-option"
										key={character.id}
										onClick={() => setSelectedId(character.id)}
									>
										<span
											className={`character-card ${isSelected ? "selected" : ""}`}
										>
											<img src={character.image} alt={character.name} />
											{isSelected && (
												<span className="selected-check">
													<Check />
												</span>
											)}
										</span>
										<span>{character.name}</span>
									</button>
								);
							})}
						</div>
						{canScrollRight && (
							<Button
								variant="ghost"
								className="button button-ghost carousel-arrow right"
								onClick={() => scroll("right")}
								aria-label="Scroll right"
							>
								<ChevronRight />
							</Button>
						)}
					</div>
					<Button
						className="button button-primary next-button"
						onClick={() => {
							setScreen("welcome");
							void startChat();
						}}
					>
						Start speaking
					</Button>
				</section>
			)}

			<Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
				<DialogContent className="settings-dialog">
					<DialogHeader className="dialog-header">
						<DialogTitle>Conversation settings</DialogTitle>
					</DialogHeader>
					<label className="field">
						<span>System prompt</span>
						<textarea
							value={systemPrompt}
							onChange={(event) => setSystemPrompt(event.target.value)}
						/>
					</label>
					<label className="field">
						<span>Max tokens</span>
						<input
							value={maxTokens}
							onChange={(event) => setMaxTokens(event.target.value)}
							type="number"
							min="1"
							placeholder="blank = no cap"
						/>
					</label>
					<p className="settings-note">
						<Volume2 /> Character choice appends a voice style prompt; audio
						uses Supertonic 3.
					</p>
				</DialogContent>
			</Dialog>
		</main>
	);
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");
createRoot(rootElement).render(<App />);
