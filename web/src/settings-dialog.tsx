import { ChevronDown, Volume2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
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
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
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
import { languages } from "./app-data";
import type { Character, SettingsAction, SettingsState } from "./app-types";
import { castAgent } from "./voice-agent-config";

interface SettingsDialogProps {
	onChange: React.Dispatch<SettingsAction>;
	selected: Character;
	selectedVoicePrompt: string;
	settings: SettingsState;
}

const mobileSettingsQuery = "(max-width: 760px)";

function useMediaQuery(query: string) {
	const [matches, setMatches] = useState(() =>
		typeof window === "undefined" ? false : window.matchMedia(query).matches,
	);

	useEffect(() => {
		const mediaQuery = window.matchMedia(query);
		const handleChange = () => setMatches(mediaQuery.matches);

		handleChange();
		mediaQuery.addEventListener("change", handleChange);

		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [query]);

	return matches;
}

export function SettingsDialog({
	onChange,
	selected,
	selectedVoicePrompt,
	settings,
}: SettingsDialogProps) {
	const isMobile = useMediaQuery(mobileSettingsQuery);
	const handleOpenChange = (value: boolean) =>
		onChange({ type: "setOpen", value });

	if (isMobile) {
		return (
			<Drawer open={settings.open} onOpenChange={handleOpenChange}>
				<DrawerContent className="settings-surface settings-drawer">
					<DrawerHeader className="dialog-header">
						<DrawerTitle>Conversation settings</DrawerTitle>
					</DrawerHeader>
					<SettingsContent
						onChange={onChange}
						selected={selected}
						selectedVoicePrompt={selectedVoicePrompt}
						settings={settings}
					/>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Dialog open={settings.open} onOpenChange={handleOpenChange}>
			<DialogContent className="settings-surface settings-dialog">
				<DialogHeader className="dialog-header">
					<DialogTitle>Conversation settings</DialogTitle>
				</DialogHeader>
				<SettingsContent
					onChange={onChange}
					selected={selected}
					selectedVoicePrompt={selectedVoicePrompt}
					settings={settings}
				/>
			</DialogContent>
		</Dialog>
	);
}

function SettingsContent({
	onChange,
	selected,
	selectedVoicePrompt,
	settings,
}: SettingsDialogProps) {
	return (
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
						onChange({
							type: "setLanguageCode",
							value,
							defaultPrompt: castAgent.defaultInstructions(value),
						})
					}
				>
					<SelectTrigger id="conversation-language" className="settings-select">
						<SelectValue />
					</SelectTrigger>
					<SelectContent position="popper" className="settings-select-content">
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
				onOpenChange={(value) => onChange({ type: "setAdvancedOpen", value })}
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
						<FieldLabel htmlFor="web-tools-enabled">Web tools</FieldLabel>
						<Select
							value={settings.webToolsEnabled ? "on" : "off"}
							onValueChange={(value) =>
								onChange({
									type: "setWebToolsEnabled",
									value: value === "on",
								})
							}
						>
							<SelectTrigger id="web-tools-enabled" className="settings-select">
								<SelectValue />
							</SelectTrigger>
							<SelectContent
								position="popper"
								className="settings-select-content"
							>
								<SelectGroup>
									<SelectItem value="on">On</SelectItem>
									<SelectItem value="off">Off</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor="auto-greeting-enabled">
							Auto greeting
						</FieldLabel>
						<Select
							value={settings.autoGreetingEnabled ? "on" : "off"}
							onValueChange={(value) =>
								onChange({
									type: "setAutoGreetingEnabled",
									value: value === "on",
								})
							}
						>
							<SelectTrigger
								id="auto-greeting-enabled"
								className="settings-select"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent
								position="popper"
								className="settings-select-content"
							>
								<SelectGroup>
									<SelectItem value="on">On</SelectItem>
									<SelectItem value="off">Off</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
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
				<Volume2 /> Start conversation sends the system prompt plus the selected
				language and character prompts.
			</FieldDescription>
		</FieldGroup>
	);
}
