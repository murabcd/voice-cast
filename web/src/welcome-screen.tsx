import { ArrowRight, Globe2, MicOff, Play } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import type { Character, Phase } from "./app-types";

interface WelcomeScreenProps {
	active: boolean;
	avatarIsSpeaking: boolean;
	jawOpen: number;
	onCharacter: () => void;
	onSettings: () => void;
	onStartStop: () => void;
	onTogglePreview: () => void;
	phase: Phase;
	previewAnimation: boolean;
	selected: Character;
	webSearchActive: boolean;
}

export function WelcomeScreen({
	active,
	avatarIsSpeaking,
	jawOpen,
	onCharacter,
	onSettings,
	onStartStop,
	onTogglePreview,
	phase,
	previewAnimation,
	selected,
	webSearchActive,
}: WelcomeScreenProps) {
	return (
		<section className="welcome-screen">
			<div className="welcome-inner">
				<h1>Talk with a cartoon</h1>
				<Button
					type="button"
					variant="ghost"
					className={`demo-card ${active || previewAnimation ? "is-active" : ""} ${previewAnimation ? "is-previewing" : ""} ${avatarIsSpeaking ? "is-speaking" : ""}`}
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
							} as React.CSSProperties
						}
					>
						<img src={selected.image} alt="" />
						<span aria-hidden="true" className="avatar-jaw">
							<img src={selected.image} alt="" />
						</span>
						<span aria-hidden="true" className="avatar-breath" />
					</span>
					{webSearchActive && (
						<output
							className="web-search-indicator"
							aria-label="Using web search"
						>
							<Globe2 />
						</output>
					)}
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
				</Button>

				<ul className="steps" aria-label="Conversation steps">
					<li className="step active">
						<b>1</b>Pick a character
					</li>
					<ArrowRight aria-hidden="true" />
					<li className="step">
						<b>2</b>Start conversation
					</li>
					<ArrowRight aria-hidden="true" />
					<li className="step">
						<b>3</b>Hear the reply
					</li>
				</ul>

				<Button
					className="button button-primary primary-cta"
					onClick={onStartStop}
				>
					{active ? "Stop conversation" : "Start conversation"}
				</Button>
				<div className="secondary-actions">
					<Button
						variant="secondary"
						className="button button-secondary"
						onClick={onSettings}
					>
						Settings
					</Button>
					<Button
						variant="secondary"
						className="button button-secondary"
						onClick={onCharacter}
					>
						Character
					</Button>
				</div>
				{import.meta.env.DEV && (
					<Button
						type="button"
						variant="ghost"
						className="animation-preview"
						onClick={onTogglePreview}
					>
						Animation preview
					</Button>
				)}
			</div>
		</section>
	);
}
