export type Phase = "idle" | "warming" | "hearing" | "thinking" | "speaking";
export type Screen = "welcome" | "pick";
export type ToolActivityProvider = "web" | "yandex-tracker";

export interface ToolResultSource {
	title: string;
	url?: string;
}

export interface ToolResultItem {
	content: string;
	title: string;
	url?: string;
}

export interface ToolResultSection {
	label: string;
	text: string;
}

export interface ToolResultSummary {
	id: string;
	provider: ToolActivityProvider;
	query?: string;
	sections: ToolResultSection[];
	sources: ToolResultSource[];
	summary: string;
	title: string;
	tools: string[];
	results: ToolResultItem[];
}

export interface SettingsState {
	open: boolean;
	systemPrompt: string;
	systemPromptEdited: boolean;
	languageCode: string;
	maxTokens: string;
	temperature: string;
	topP: string;
	repeatPenalty: string;
	webToolsEnabled: boolean;
	advancedOpen: boolean;
}

export type SettingsAction =
	| { type: "setOpen"; value: boolean }
	| { type: "setSystemPrompt"; value: string }
	| { type: "setLanguageCode"; defaultPrompt: string; value: string }
	| { type: "setMaxTokens"; value: string }
	| { type: "setTemperature"; value: string }
	| { type: "setTopP"; value: string }
	| { type: "setRepeatPenalty"; value: string }
	| { type: "setWebToolsEnabled"; value: boolean }
	| { type: "setAdvancedOpen"; value: boolean };

export interface LanguageOption {
	code: string;
	name: string;
}

export interface Character {
	id: number;
	name: string;
	image: string;
	voiceName: string;
	prompts: {
		en: string;
		ru: string;
	};
	jaw: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
}
