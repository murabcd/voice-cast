import React from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { characters, languages } from "./app-data";
import type { Screen, SettingsAction, SettingsState } from "./app-types";
import "./avatar-animation.css";
import { PickScreen } from "./pick-screen";
import { SettingsDialog } from "./settings-dialog";
import "./styles.css";
import { useVoiceSession } from "./use-voice-session";
import { castAgent } from "./voice-agent-config";
import { WelcomeScreen } from "./welcome-screen";

const selectedCharacterKey = "voice-cast:selected-character";
const selectedLanguageKey = "voice-cast:selected-language";

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
			return { ...state, systemPrompt: action.value, systemPromptEdited: true };
		case "setLanguageCode":
			return {
				...state,
				languageCode: action.value,
				systemPrompt: state.systemPromptEdited
					? state.systemPrompt
					: action.defaultPrompt,
			};
		case "setMaxTokens":
			return { ...state, maxTokens: action.value };
		case "setTemperature":
			return { ...state, temperature: action.value };
		case "setTopP":
			return { ...state, topP: action.value };
		case "setRepeatPenalty":
			return { ...state, repeatPenalty: action.value };
		case "setWebToolsEnabled":
			return { ...state, webToolsEnabled: action.value };
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

function cancelAnimationFrameRef(ref: React.RefObject<number>) {
	const frame = ref.current;
	if (!frame) return;
	cancelAnimationFrame(frame);
	ref.current = 0;
}

function App() {
	const initialLanguageCode = React.useMemo(() => getInitialLanguage(), []);
	const [view, setView] = React.useReducer(viewReducer, {
		canScrollLeft: false,
		canScrollRight: false,
		previewAnimation: false,
		screen: "welcome",
		selectedId: getInitialSelectedId(),
	});
	const [settings, dispatchSettings] = React.useReducer(settingsReducer, {
		open: false,
		languageCode: initialLanguageCode,
		systemPrompt: castAgent.defaultInstructions(initialLanguageCode),
		systemPromptEdited: false,
		maxTokens: "512",
		temperature: "0.35",
		topP: "0.9",
		repeatPenalty: "1.05",
		webToolsEnabled: true,
		advancedOpen: false,
	});
	const selected =
		characters.find((character) => character.id === view.selectedId) ??
		characters[0];
	const selectedLanguage =
		languages.find((language) => language.code === settings.languageCode) ??
		languages[0];
	const selectedCharacterPrompt =
		settings.languageCode === "ru" ? selected.prompts.ru : selected.prompts.en;
	const voiceSession = useVoiceSession({
		previewAnimation: view.previewAnimation,
		selected,
		selectedCharacterPrompt,
		selectedLanguage,
		settings,
	});
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const scrollRafRef = React.useRef(0);
	const updateScrollButtonsRef = React.useRef<() => void>(() => undefined);

	React.useEffect(() => {
		try {
			localStorage.setItem(selectedCharacterKey, String(view.selectedId));
		} catch {}
	}, [view.selectedId]);

	React.useEffect(() => {
		try {
			localStorage.setItem(selectedLanguageKey, settings.languageCode);
		} catch {}
	}, [settings.languageCode]);

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
	const selectedVoicePrompt = `Character voice: ${selectedCharacterPrompt}`;

	return (
		<main className="app-shell">
			<Button
				type="button"
				variant="ghost"
				className="brand"
				onClick={() => setView({ screen: "welcome" })}
			>
				<span>Voice Cast</span>
			</Button>

			{view.screen === "welcome" && (
				<WelcomeScreen
					active={voiceSession.active}
					avatarIsListening={voiceSession.avatarIsListening}
					avatarIsSpeaking={voiceSession.avatarIsSpeaking}
					jawOpen={voiceSession.jawOpen}
					listeningEnergy={voiceSession.listeningEnergy}
					onCharacter={() => setView({ screen: "pick" })}
					onSettings={() => dispatchSettings({ type: "setOpen", value: true })}
					onStartStop={voiceSession.handleStartStop}
					onTogglePreview={() =>
						setView({ previewAnimation: !view.previewAnimation })
					}
					phase={voiceSession.phase}
					previewAnimation={view.previewAnimation}
					selected={selected}
					webSearchActive={voiceSession.webSearchActive}
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
