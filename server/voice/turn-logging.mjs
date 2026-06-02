import { logEvent } from "./logger.mjs";
import { cleanLlmText } from "./text.mjs";

export function createTurnLog({
	turnId,
	startedAt,
	transcript,
	settings,
	config,
}) {
	return {
		event: "voice_turn",
		turn_id: turnId,
		request_id: `turn-${turnId}-${startedAt}`,
		transcript,
		transcript_chars: transcript.length,
		language: settings.language,
		voice_name: settings.voiceName,
		character_id: settings.characterId,
		web_tools_enabled: settings.webToolsEnabled ?? true,
		history_turns: 0,
		max_tokens: settings.maxTokens ?? config.llama.maxTokens,
		temperature: settings.temperature ?? config.llama.temperature,
		top_p: settings.topP ?? config.llama.topP,
		repeat_penalty: settings.repeatPenalty ?? config.llama.repeatPenalty,
		tool_calls_count: 0,
		tool_names: [],
		speech_count: 0,
		tts_chars: 0,
		spoken_chars: 0,
		started_at_ms: startedAt,
	};
}

export function emitTurnLog(turn, outcome, fields = {}) {
	if (!turn?.logEvent || turn.logEventEmitted) return;
	turn.logEventEmitted = true;
	logEvent({
		...turn.logEvent,
		level: outcome === "error" ? "error" : "info",
		outcome,
		duration_ms: Date.now() - turn.startedAt,
		reply_chars: cleanLlmText(turn.reply).length,
		pending_speech: turn.pendingSpeech,
		...fields,
	});
}

export function emitIgnoredTurnLog({ reason, transcript }) {
	logEvent({
		event: "voice_turn_ignored",
		outcome: "ignored",
		reason,
		transcript,
		transcript_chars: transcript.length,
	});
}

export function recordQueuedSpeech({
	turn,
	text,
	spokenText,
	queuedAt,
	speechIndex,
}) {
	turn.logEvent.speech_count = Math.max(
		turn.logEvent.speech_count,
		speechIndex,
	);
	turn.logEvent.tts_chars += text.length;
	turn.logEvent.spoken_chars += spokenText.length;
	turn.logEvent.first_tts_queue_ms ??= queuedAt - turn.startedAt;
}

export function recordFirstTtsAudio(turn) {
	turn.logEvent.first_tts_audio_ms ??= Date.now() - turn.startedAt;
}

export function recordToolPreamble({ turn, sentence, startedAt }) {
	turn.logEvent.tool_preamble = sentence;
	turn.logEvent.tool_preamble_ms = Date.now() - startedAt;
}

export function recordToolRoute({ turn, route }) {
	turn.logEvent.tool_route_kind = route.kind;
	turn.logEvent.tool_route_category = route.category;
	turn.logEvent.tool_route_tools = route.toolNames;
	turn.logEvent.tool_route_tools_count = route.toolNames.length;
	turn.logEvent.tool_route_arguments = route.arguments;
	turn.logEvent.tool_route_query = route.query;
	turn.logEvent.tool_route_query_chars = route.queryChars;
	turn.logEvent.tool_route_web_followup = route.webFollowUp;
}

export function recordToolCall(turn, name) {
	turn.logEvent.tool_calls_count += 1;
	if (!turn.logEvent.tool_names.includes(name))
		turn.logEvent.tool_names.push(name);
}
