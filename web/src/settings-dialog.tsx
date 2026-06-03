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
import { cn } from "./lib/utils";
import { castAgent } from "./voice-agent-config";

interface SettingsDialogProps {
	onChange: React.Dispatch<SettingsAction>;
	selected: Character;
	selectedStylePrompt: string;
	settings: SettingsState;
}

const mobileSettingsQuery = "(max-width: 760px)";
const settingsNumberInputClassName = "h-8 text-sm tabular-nums";

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
	selectedStylePrompt,
	settings,
}: SettingsDialogProps) {
	const isMobile = useMediaQuery(mobileSettingsQuery);
	const handleOpenChange = (value: boolean) =>
		onChange({ type: "setOpen", value });

	if (isMobile) {
		return (
			<Drawer open={settings.open} onOpenChange={handleOpenChange}>
				<DrawerContent className="flex max-h-[min(84svh,760px)] flex-col gap-0 overflow-hidden rounded-t-[18px] bg-white px-5 pt-4 pb-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)] max-[760px]:w-full">
					<DrawerHeader className="mb-3.5 flex shrink-0 items-center justify-between gap-4 p-0 pt-2 text-left [&_h2]:m-0 [&_h2]:text-xl">
						<DrawerTitle>Conversation settings</DrawerTitle>
					</DrawerHeader>
					<SettingsContent
						onChange={onChange}
						selected={selected}
						selectedStylePrompt={selectedStylePrompt}
						settings={settings}
					/>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Dialog open={settings.open} onOpenChange={handleOpenChange}>
			<DialogContent className="flex max-h-[min(760px,90vh)] w-[min(640px,calc(100vw-32px))] flex-col gap-0 overflow-hidden rounded-2xl bg-white p-7 shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
				<DialogHeader className="mb-[18px] flex shrink-0 items-center justify-between gap-4 [&_h2]:m-0 [&_h2]:text-[22px]">
					<DialogTitle>Conversation settings</DialogTitle>
				</DialogHeader>
				<SettingsContent
					onChange={onChange}
					selected={selected}
					selectedStylePrompt={selectedStylePrompt}
					settings={settings}
				/>
			</DialogContent>
		</Dialog>
	);
}

function SettingsContent({
	onChange,
	selected,
	selectedStylePrompt,
	settings,
}: SettingsDialogProps) {
	return (
		<FieldGroup className="-mx-1 min-h-0 gap-4 overflow-y-auto px-1 pt-1 pb-1 [scrollbar-width:none] max-[760px]:pb-[calc(env(safe-area-inset-bottom)+4px)] [&::-webkit-scrollbar]:hidden [&_[data-slot=field-label]]:text-[13px] [&_[data-slot=field-label]]:font-bold [&_[data-slot=field-label]]:text-[#5d5d5d] [&_[data-slot=field]]:gap-2">
			<Field>
				<FieldLabel htmlFor="system-prompt">System prompt</FieldLabel>
				<Textarea
					id="system-prompt"
					className="min-h-[170px] resize-none p-3 leading-[1.4]"
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
					<SelectTrigger id="conversation-language" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent
						position="popper"
						className="max-h-[min(320px,calc(100vh-96px))]"
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
				<FieldDescription className="rounded-[10px] border border-[#e0e0e0] bg-[#f7f7f7] p-3 text-sm leading-[1.45] text-[#1f1f1f]">
					{selectedStylePrompt}
				</FieldDescription>
			</Field>
			<Collapsible
				open={settings.advancedOpen}
				onOpenChange={(value) => onChange({ type: "setAdvancedOpen", value })}
				className="mb-4"
			>
				<CollapsibleTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						className="h-[42px] w-full justify-between border-0 bg-transparent px-0 text-[13px] font-bold text-[#5d5d5d] shadow-none hover:bg-transparent hover:text-[#5d5d5d] active:translate-y-0 aria-expanded:bg-transparent aria-expanded:text-[#5d5d5d] focus-visible:border-transparent focus-visible:ring-0"
					>
						Advanced
						<ChevronDown
							data-icon="inline-end"
							className={cn(
								"transition-transform duration-160 ease-out",
								settings.advancedOpen && "rotate-180",
							)}
						/>
					</Button>
				</CollapsibleTrigger>
				<CollapsibleContent className="flex flex-col gap-4 pt-3">
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
							<SelectTrigger id="web-tools-enabled" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent
								position="popper"
								className="max-h-[min(320px,calc(100vh-96px))]"
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
							<SelectTrigger id="auto-greeting-enabled" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent
								position="popper"
								className="max-h-[min(320px,calc(100vh-96px))]"
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
							className={settingsNumberInputClassName}
							value={settings.maxTokens}
							onChange={(event) =>
								onChange({
									type: "setMaxTokens",
									value: event.target.value,
								})
							}
							type="text"
							inputMode="numeric"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="temperature">Temperature</FieldLabel>
						<Input
							id="temperature"
							className={settingsNumberInputClassName}
							value={settings.temperature}
							onChange={(event) =>
								onChange({
									type: "setTemperature",
									value: event.target.value,
								})
							}
							type="text"
							inputMode="decimal"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="top-p">Top P</FieldLabel>
						<Input
							id="top-p"
							className={settingsNumberInputClassName}
							value={settings.topP}
							onChange={(event) =>
								onChange({ type: "setTopP", value: event.target.value })
							}
							type="text"
							inputMode="decimal"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="repeat-penalty">Repeat penalty</FieldLabel>
						<Input
							id="repeat-penalty"
							className={settingsNumberInputClassName}
							value={settings.repeatPenalty}
							onChange={(event) =>
								onChange({
									type: "setRepeatPenalty",
									value: event.target.value,
								})
							}
							type="text"
							inputMode="decimal"
						/>
					</Field>
				</CollapsibleContent>
			</Collapsible>
			<FieldDescription className="mt-1 flex items-center gap-2 text-[13px] text-[#626262] [&_svg]:size-4 [&_svg]:shrink-0">
				<Volume2 /> Start conversation sends the system prompt plus the selected
				language and character prompts.
			</FieldDescription>
		</FieldGroup>
	);
}
