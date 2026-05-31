export type Phase = "idle" | "hearing" | "thinking" | "speaking";
export type Screen = "welcome" | "pick";

export interface SettingsState {
	open: boolean;
	systemPrompt: string;
	languageCode: string;
	maxTokens: string;
	temperature: string;
	topP: string;
	repeatPenalty: string;
	advancedOpen: boolean;
}

export type SettingsAction =
	| { type: "setOpen"; value: boolean }
	| { type: "setSystemPrompt"; value: string }
	| { type: "setLanguageCode"; value: string }
	| { type: "setMaxTokens"; value: string }
	| { type: "setTemperature"; value: string }
	| { type: "setTopP"; value: string }
	| { type: "setRepeatPenalty"; value: string }
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
