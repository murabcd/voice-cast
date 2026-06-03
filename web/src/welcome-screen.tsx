import { ArrowRight, Globe2, MicOff, Play } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import type { Character, Phase, ToolActivityProvider } from "./app-types";
import { Icons } from "./icons";
import { cn } from "./lib/utils";

interface WelcomeScreenProps {
	active: boolean;
	avatarIsListening: boolean;
	avatarIsSpeaking: boolean;
	jawOpen: number;
	listeningEnergy: number;
	onCharacter: () => void;
	onSettings: () => void;
	onStartStop: () => void;
	onTogglePreview: () => void;
	phase: Phase;
	previewAnimation: boolean;
	selected: Character;
	activeToolProvider: ToolActivityProvider | null;
}

export function WelcomeScreen({
	active,
	avatarIsListening,
	avatarIsSpeaking,
	jawOpen,
	listeningEnergy,
	onCharacter,
	onSettings,
	onStartStop,
	onTogglePreview,
	phase,
	previewAnimation,
	selected,
	activeToolProvider,
}: WelcomeScreenProps) {
	const phaseLabel = activeToolProvider
		? "Searching"
		: phase === "warming"
			? "Preparing"
			: phase[0].toUpperCase() + phase.slice(1);
	const activeStepRef = useRef(1);
	if (!active) activeStepRef.current = 1;
	else if (phase === "thinking" || phase === "speaking" || activeToolProvider)
		activeStepRef.current = 3;
	else activeStepRef.current = Math.max(activeStepRef.current, 2);
	const activeStep = activeStepRef.current;
	return (
		<section className="flex min-h-screen items-center justify-center px-6 pt-[90px] pb-[58px] max-[760px]:min-h-svh max-[760px]:items-start max-[760px]:px-[18px] max-[760px]:pt-[86px] max-[760px]:pb-[52px]">
			<div className="w-[min(520px,100%)] text-center">
				<h1 className="mb-[34px] text-[34px] leading-[1.12] font-[520] tracking-normal max-[760px]:text-[29px]">
					Talk with a cartoon
				</h1>
				<Button
					type="button"
					variant="ghost"
					className={cn(
						"demo-card group/demo relative mx-auto mb-7 block aspect-video h-auto w-[min(420px,100%)] cursor-pointer overflow-hidden rounded-2xl border-0 bg-[#f2f2f2] p-0 shadow-[0_20px_34px_rgba(0,0,0,0.14)] after:absolute after:inset-0 after:bg-black/18 hover:bg-[#f2f2f2] focus-visible:bg-[#f2f2f2]",
						active || previewAnimation ? "is-active" : "",
						previewAnimation ? "is-previewing" : "",
						avatarIsSpeaking ? "is-speaking" : "",
						avatarIsListening ? "is-listening" : "",
					)}
					onClick={onStartStop}
					aria-label={active ? "Stop conversation" : "Start conversation"}
				>
					<span
						className="avatar-stage"
						style={
							{
								"--jaw-x": `${selected.jaw.x}%`,
								"--jaw-y": `${selected.jaw.y}%`,
								"--jaw-width": `${selected.jaw.width}%`,
								"--jaw-height": `${selected.jaw.height}%`,
								"--jaw-open": avatarIsSpeaking ? jawOpen : 0,
								"--jaw-img-width": `${10000 / selected.jaw.width}%`,
								"--jaw-img-height": `${10000 / selected.jaw.height}%`,
								"--jaw-img-left": `${(-selected.jaw.x / selected.jaw.width) * 100}%`,
								"--jaw-img-top": `${(-selected.jaw.y / selected.jaw.height) * 100}%`,
								"--listen-energy": listeningEnergy,
							} as React.CSSProperties
						}
					>
						<img src={selected.image} alt="" />
						<span aria-hidden="true" className="avatar-jaw">
							<img src={selected.image} alt="" />
						</span>
						<span aria-hidden="true" className="avatar-breath" />
					</span>
					{activeToolProvider && (
						<output
							className="pointer-events-none absolute top-3.5 right-3.5 z-[3] flex size-[38px] items-center justify-center rounded-full bg-white/90 text-[#111] shadow-[0_0_0_0_rgba(255,255,255,0.68),0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-[10px] animate-[tool-activity-pulse_1.18s_ease-out_infinite] [&_svg]:size-5"
							aria-label={toolActivityLabel(activeToolProvider)}
						>
							<ToolActivityIcon provider={activeToolProvider} />
						</output>
					)}
					<span
						className={cn(
							"absolute top-1/2 left-1/2 z-2 flex size-[62px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/55 text-black shadow-[0_12px_25px_rgba(0,0,0,0.18)] backdrop-blur-[10px] transition-[background,opacity,transform] duration-160 ease-out [&_svg]:ml-[3px] [&_svg]:size-7",
							(active || previewAnimation) &&
								"pointer-events-none opacity-0 scale-[0.96]",
							(active || !previewAnimation) &&
								"group-hover/demo:opacity-100 group-hover/demo:scale-100 group-hover/demo:bg-white/95 group-focus-visible/demo:opacity-100 group-focus-visible/demo:scale-100 group-focus-visible/demo:bg-white/95",
							previewAnimation &&
								"group-hover/demo:opacity-0 group-hover/demo:scale-[0.96] group-focus-visible/demo:opacity-0 group-focus-visible/demo:scale-[0.96]",
						)}
					>
						{active ? <MicOff /> : <Play fill="currentColor" />}
					</span>
					<span
						className={cn(
							"absolute top-[calc(50%+44px)] left-1/2 z-2 -translate-x-1/2 rounded-full bg-black/55 px-3.5 py-2 text-[13px] font-bold text-white backdrop-blur-[7px]",
							previewAnimation && "opacity-0",
						)}
					>
						{active ? phaseLabel : "Speak directly"}
					</span>
					<span className="absolute bottom-3.5 left-3.5 z-2 flex items-center gap-[7px] rounded-full bg-white/90 py-[5px] pr-[11px] pl-[5px] text-xs font-bold text-[#111] shadow-[0_4px_14px_rgba(0,0,0,0.12)] backdrop-blur-sm [&_img]:size-6 [&_img]:rounded-full [&_img]:object-cover">
						<img src={selected.image} alt="" />
						{selected.name}
					</span>
				</Button>

				<ul
					className="mb-[34px] flex list-none items-start justify-center gap-3.5 p-0 max-[760px]:gap-2 [&>svg]:mt-2 [&>svg]:w-[13px] [&>svg]:text-black/15"
					aria-label="Conversation steps"
				>
					<li className="flex min-w-[88px] flex-col items-center gap-[7px] text-xs max-[760px]:min-w-[72px] max-[760px]:text-[11px]">
						<b
							className={cn(
								"flex size-[30px] items-center justify-center rounded-full bg-[#ededed]",
								activeStep === 1 && "bg-[#050505] text-white",
							)}
						>
							1
						</b>
						Pick a character
					</li>
					<ArrowRight aria-hidden="true" />
					<li className="flex min-w-[88px] flex-col items-center gap-[7px] text-xs max-[760px]:min-w-[72px] max-[760px]:text-[11px]">
						<b
							className={cn(
								"flex size-[30px] items-center justify-center rounded-full bg-[#ededed]",
								activeStep === 2 && "bg-[#050505] text-white",
							)}
						>
							2
						</b>
						Start conversation
					</li>
					<ArrowRight aria-hidden="true" />
					<li className="flex min-w-[88px] flex-col items-center gap-[7px] text-xs max-[760px]:min-w-[72px] max-[760px]:text-[11px]">
						<b
							className={cn(
								"flex size-[30px] items-center justify-center rounded-full bg-[#ededed]",
								activeStep === 3 && "bg-[#050505] text-white",
							)}
						>
							3
						</b>
						Hear the reply
					</li>
				</ul>

				<Button
					className="h-12 w-[min(380px,100%)] gap-[9px] rounded-xl bg-[#050505] px-[22px] font-[650] text-white shadow-[0_10px_24px_rgba(0,0,0,0.1)] transition-[transform,background,opacity,box-shadow] duration-140 ease-out active:scale-[0.985] hover:bg-[#202020] [&_svg]:size-[17px]"
					onClick={onStartStop}
				>
					{active ? "Stop conversation" : "Start conversation"}
				</Button>
				<div className="mx-auto mt-4 flex w-[min(380px,100%)] gap-3 max-[760px]:flex-col">
					<Button
						variant="secondary"
						className="h-12 flex-auto gap-[9px] rounded-xl bg-[#e9e9e9] px-[22px] font-[650] text-black/70 transition-[transform,background,opacity,box-shadow] duration-140 ease-out active:scale-[0.985] hover:bg-[#dedede] max-[760px]:h-12 max-[760px]:w-full max-[760px]:flex-none max-[760px]:text-base max-[760px]:leading-none [&_svg]:size-[17px]"
						onClick={onSettings}
					>
						Settings
					</Button>
					<Button
						variant="secondary"
						className="h-12 flex-auto gap-[9px] rounded-xl bg-[#e9e9e9] px-[22px] font-[650] text-black/70 transition-[transform,background,opacity,box-shadow] duration-140 ease-out active:scale-[0.985] hover:bg-[#dedede] max-[760px]:h-12 max-[760px]:w-full max-[760px]:flex-none max-[760px]:text-base max-[760px]:leading-none [&_svg]:size-[17px]"
						onClick={onCharacter}
					>
						Character
					</Button>
				</div>
				{import.meta.env.DEV && (
					<Button
						type="button"
						variant="ghost"
						className="mt-3.5 h-auto border-0 bg-transparent p-0 text-xs font-[650] text-black/40 hover:bg-transparent hover:text-black/70 focus-visible:bg-transparent"
						onClick={onTogglePreview}
					>
						Preview
					</Button>
				)}
			</div>
		</section>
	);
}

function ToolActivityIcon({ provider }: { provider: ToolActivityProvider }) {
	if (provider === "yandex-tracker") {
		const YandexTrackerLogo = Icons.yandexTrackerLogo;
		return <YandexTrackerLogo className="text-blue-600" />;
	}
	return <Globe2 />;
}

function toolActivityLabel(provider: ToolActivityProvider) {
	if (provider === "yandex-tracker") return "Using Yandex Tracker";
	return "Using web search";
}
