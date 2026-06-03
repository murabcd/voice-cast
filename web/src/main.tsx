import React from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { characters, languages } from "./app-data";
import type { Screen, SettingsAction, SettingsState } from "./app-types";
import "./avatar-animation.css";
import { PickScreen } from "./pick-screen";
import { SettingsDialog } from "./settings-dialog";
import { SourceSheet } from "./source-sheet";
import "./styles.css";
import { cn } from "./lib/utils";
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
		case "setAutoGreetingEnabled":
			return { ...state, autoGreetingEnabled: action.value };
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
		autoGreetingEnabled: true,
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
		onCharacterHandoff: (characterId) => setView({ selectedId: characterId }),
		previewAnimation: view.previewAnimation,
		selected,
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
	const selectedStylePrompt = `Speaking style: ${selectedCharacterPrompt}`;

	const sourcePanelOpen = voiceSession.toolResultOpen;

	return (
		<main
			className={cn(
				"relative min-h-screen bg-white text-[#050505] [--source-panel-width:var(--source-panel-width-current,256px)] min-[900px]:transition-[padding-right] min-[900px]:duration-200 min-[900px]:ease-linear",
				sourcePanelOpen && "min-[900px]:pr-(--source-panel-width)",
			)}
		>
			<Button
				type="button"
				variant="ghost"
				className={cn(
					"fixed top-[22px] left-7 z-20 flex h-auto items-center gap-[9px] border-0 bg-transparent p-0 text-[#050505] no-underline transition-opacity duration-180 ease-out hover:opacity-60",
					"[&_span]:font-['Geist_Pixel',ui-sans-serif,system-ui] [&_span]:text-[25px]",
					"max-[760px]:top-4 max-[760px]:left-4 max-[760px]:[&_span]:text-xl",
					"hover:bg-transparent focus-visible:bg-transparent aria-expanded:bg-transparent",
					sourcePanelOpen &&
						"min-[900px]:max-w-[calc(100vw-var(--source-panel-width)-56px)]",
				)}
				onClick={() => setView({ screen: "welcome" })}
			>
				<span>Voice Cast</span>
			</Button>
			<Button
				type="button"
				variant="secondary"
				className={cn(
					"fixed top-[22px] right-7 z-20 transition-[right] duration-200 ease-linear",
					"max-[760px]:top-3 max-[760px]:right-4 max-[760px]:h-[34px] max-[760px]:rounded-xl max-[760px]:px-[13px] max-[760px]:text-sm max-[760px]:font-[650]",
					sourcePanelOpen &&
						"min-[900px]:right-[calc(var(--source-panel-width)+28px)]",
					"[[data-source-panel-resizing-pending=true]_&]:pointer-events-none [[data-source-panel-resizing-pending=true]_&]:cursor-default [[data-source-panel-resizing-pending=true]_&]:bg-[#e9e9e9] [[data-source-panel-resizing-pending=true]_&]:transition-none",
					"[[data-source-panel-resizing=true]_&]:pointer-events-none [[data-source-panel-resizing=true]_&]:cursor-default [[data-source-panel-resizing=true]_&]:bg-[#e9e9e9] [[data-source-panel-resizing=true]_&]:transition-none",
				)}
				onClick={() =>
					voiceSession.setToolResultOpen(!voiceSession.toolResultOpen)
				}
			>
				Sources
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
					activeToolProvider={voiceSession.activeToolProvider}
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
				selectedStylePrompt={selectedStylePrompt}
				settings={settings}
			/>
			<SourceSheet
				open={voiceSession.toolResultOpen}
				result={voiceSession.toolResult}
				onOpenChange={voiceSession.setToolResultOpen}
			/>
		</main>
	);
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");
createRoot(rootElement).render(<App />);
