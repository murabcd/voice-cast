import { z } from "zod";

const phaseSchema = z.union([
	z.literal("idle"),
	z.literal("warming"),
	z.literal("hearing"),
	z.literal("thinking"),
	z.literal("speaking"),
]);

const serverMessageSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("status"), text: z.string() }).passthrough(),
	z.object({ type: z.literal("warning"), message: z.string() }).passthrough(),
	z.object({ type: z.literal("error"), message: z.string() }).passthrough(),
	z.object({ type: z.literal("transcript"), text: z.string() }).passthrough(),
	z.object({ type: z.literal("reply_delta"), text: z.string() }).passthrough(),
	z.object({ type: z.literal("done"), reply: z.string() }).passthrough(),
	z.object({ type: z.literal("turn_done"), reply: z.string() }).passthrough(),
	z.object({ type: z.literal("state"), phase: phaseSchema }).passthrough(),
	z.object({ type: z.literal("stt_ready"), ready: z.boolean() }).passthrough(),
	z.object({ type: z.literal("stt_event"), event: z.unknown() }).passthrough(),
	z
		.object({
			type: z.literal("character_handoff"),
			characterId: z.number().int(),
			characterName: z.string().optional(),
			voiceName: z.string().optional(),
		})
		.passthrough(),
	z.object({ type: z.literal("tool_activity") }).passthrough(),
	z.object({ type: z.literal("tool_result") }).passthrough(),
]);

export type VoiceServerMessage = z.infer<typeof serverMessageSchema>;

export function parseVoiceServerMessage(value: string) {
	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(value);
	} catch {
		return undefined;
	}
	const parsed = serverMessageSchema.safeParse(parsedJson);
	return parsed.success ? parsed.data : undefined;
}
