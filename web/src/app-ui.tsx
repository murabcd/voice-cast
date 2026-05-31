import {
	ArrowRight,
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	MicOff,
	Play,
	Volume2,
} from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { characters, languages } from "./app-data";
import type {
	Character,
	Phase,
	SettingsAction,
	SettingsState,
} from "./app-types";

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

interface PickScreenProps {
	canScrollLeft: boolean;
	canScrollRight: boolean;
	onDone: () => void;
	onScroll: () => void;
	onScrollBy: (direction: "left" | "right") => void;
	onSelect: (id: number) => void;
	scrollRef: React.RefObject<HTMLDivElement | null>;
	selectedId: number;
}

export function PickScreen({
	canScrollLeft,
	canScrollRight,
	onDone,
	onScroll,
	onScrollBy,
	onSelect,
	scrollRef,
	selectedId,
}: PickScreenProps) {
	return (
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
						onClick={() => onScrollBy("left")}
						aria-label="Scroll left"
					>
						<ChevronLeft />
					</Button>
				)}
				{canScrollLeft && <div className="carousel-fade left" />}
				{canScrollRight && <div className="carousel-fade right" />}
				<div ref={scrollRef} className="character-carousel" onScroll={onScroll}>
					{characters.map((character) => {
						const isSelected = selectedId === character.id;
						return (
							<Button
								type="button"
								variant="ghost"
								className="character-option"
								key={character.id}
								onClick={() => onSelect(character.id)}
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
							</Button>
						);
					})}
				</div>
				{canScrollRight && (
					<Button
						variant="ghost"
						className="button button-ghost carousel-arrow right"
						onClick={() => onScrollBy("right")}
						aria-label="Scroll right"
					>
						<ChevronRight />
					</Button>
				)}
			</div>
			<Button className="button button-primary next-button" onClick={onDone}>
				Save character
			</Button>
		</section>
	);
}

interface SettingsDialogProps {
	onChange: React.Dispatch<SettingsAction>;
	selected: Character;
	selectedVoicePrompt: string;
	settings: SettingsState;
}

export function SettingsDialog({
	onChange,
	selected,
	selectedVoicePrompt,
	settings,
}: SettingsDialogProps) {
	return (
		<Dialog
			open={settings.open}
			onOpenChange={(value) => onChange({ type: "setOpen", value })}
		>
			<DialogContent className="settings-dialog">
				<DialogHeader className="dialog-header">
					<DialogTitle>Conversation settings</DialogTitle>
				</DialogHeader>
				<FieldGroup className="settings-fields">
					<Field>
						<FieldLabel htmlFor="system-prompt">System prompt</FieldLabel>
						<Textarea
							id="system-prompt"
							className="settings-textarea"
							value={settings.systemPrompt}
							onChange={(event) =>
								onChange({
									type: "setSystemPrompt",
									value: event.target.value,
								})
							}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="conversation-language">Language</FieldLabel>
						<Select
							value={settings.languageCode}
							onValueChange={(value) =>
								onChange({ type: "setLanguageCode", value })
							}
						>
							<SelectTrigger
								id="conversation-language"
								className="settings-select"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent
								position="popper"
								className="settings-select-content"
							>
								<SelectGroup>
									{languages.map((language) => (
										<SelectItem value={language.code} key={language.code}>
											{language.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel>Selected character: {selected.name}</FieldLabel>
						<FieldDescription className="character-prompt-preview">
							{selectedVoicePrompt}
						</FieldDescription>
					</Field>
					<Collapsible
						open={settings.advancedOpen}
						onOpenChange={(value) =>
							onChange({ type: "setAdvancedOpen", value })
						}
						className="advanced-settings"
					>
						<CollapsibleTrigger asChild>
							<Button
								type="button"
								variant="secondary"
								className="button advanced-trigger"
							>
								Advanced
								<ChevronDown
									data-icon="inline-end"
									className={settings.advancedOpen ? "is-open" : ""}
								/>
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="advanced-content">
							<Field>
								<FieldLabel htmlFor="max-tokens">Max tokens</FieldLabel>
								<Input
									id="max-tokens"
									value={settings.maxTokens}
									onChange={(event) =>
										onChange({
											type: "setMaxTokens",
											value: event.target.value,
										})
									}
									type="number"
									min="1"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="temperature">Temperature</FieldLabel>
								<Input
									id="temperature"
									value={settings.temperature}
									onChange={(event) =>
										onChange({
											type: "setTemperature",
											value: event.target.value,
										})
									}
									type="number"
									min="0"
									max="2"
									step="0.05"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="top-p">Top P</FieldLabel>
								<Input
									id="top-p"
									value={settings.topP}
									onChange={(event) =>
										onChange({ type: "setTopP", value: event.target.value })
									}
									type="number"
									min="0"
									max="1"
									step="0.05"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="repeat-penalty">Repeat penalty</FieldLabel>
								<Input
									id="repeat-penalty"
									value={settings.repeatPenalty}
									onChange={(event) =>
										onChange({
											type: "setRepeatPenalty",
											value: event.target.value,
										})
									}
									type="number"
									min="1"
									max="2"
									step="0.01"
								/>
							</Field>
						</CollapsibleContent>
					</Collapsible>
					<FieldDescription className="settings-note">
						<Volume2 /> Start conversation sends the system prompt plus the
						selected language and character prompts.
					</FieldDescription>
				</FieldGroup>
			</DialogContent>
		</Dialog>
	);
}
