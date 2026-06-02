# Architecture

Voice Cast is a local speech-to-speech app with one maintained runtime path.

## Runtime Flow

```text
browser mic PCM
-> Node HTTP/WebSocket voice server
-> Silero VAD + Parakeet STT worker
-> SmolLM3 via llama.cpp
-> optional Ollama web tools or configured MCP tools
-> Supertonic 3 TTS
-> browser PCM playback
```

## Layers

| Layer | Files | Owns |
| --- | --- | --- |
| UI | `web/src/main.tsx`, `web/src/pick-screen.tsx`, `web/src/welcome-screen.tsx`, `web/src/settings-dialog.tsx`, `web/src/styles.css` | Screens, controls, visual state. |
| Browser runtime | `web/src/use-voice-session.ts`, `web/src/voice-wire.ts`, `web/src/tool-result-wire.ts`, `web/src/voice-audio-codec.ts`, `web/src/voice-agent-config.ts`, `web/src/use-avatar-animation.ts` | Mic capture, PCM encoding/decoding, playback, WebSocket protocol, tool result event validation, settings payload, active agent instructions, and avatar animation state. |
| Server runtime | `server/voice-server.mjs` | Composition of HTTP/static serving, WebSocket sessions, STT/LLM/TTS/tool wiring, cancellation, and shutdown. |
| Server support | `server/voice/static-server.mjs`, `server/voice/client-settings.mjs`, `server/voice/immediate-turn.mjs`, `server/voice/opening-turn.mjs`, `server/voice/session-history.mjs`, `server/voice/turn-runtime.mjs`, `server/voice/turn-logging.mjs`, `server/voice/tool-activity.mjs`, `server/voice/tool-source-card.mjs`, `server/voice/wire.mjs` | Static dist serving, settings parsing, immediate reply turn composition, startup greeting policy, compact conversation memory, turn lifecycle state, structured logging, tool activity state, tool result source-card shaping, and wire encoding. |
| AI policy | `server/ai/prompts.mjs`, `web/src/voice-agent-config.ts` | Prompt shape and active agent instructions. |
| Voice policy | `server/voice/policy/*.mjs`, `server/voice/realtime-voice-patterns.mjs` | Turn classification patterns, local tool policy, web route policy, pronunciation policy, silence/no-op handling, and tool preambles. |
| LLM | `server/voice/llama.mjs`, `server/voice/tool-loop.mjs`, `server/voice/reply-planner.mjs` | llama.cpp requests, tool-call loop, direct web grounding, and reply planning. |
| Tool routing | `server/voice/tool-selector.mjs`, `server/ai/tools/tool-registry.mjs` | Per-turn structured tool selection across local deterministic tools, optional web tools, and configured MCP tools. |
| Tools | `server/ai/tools/local-date-time-tools.mjs`, `server/ai/tools/ollama-web-tools.mjs`, `server/ai/tools/mcp-tools.mjs` | Deterministic local date/time replies, Ollama web search/fetch boundaries with payload caps, and MCP stdio client/tool normalization. |
| Speech text | `server/voice/text.mjs`, `server/voice/speech-normalization.mjs` | LLM cleanup, chunking, pronunciation normalization. |
| STT/TTS workers | `server/voice/stt-session.mjs`, `server/voice/stt-worker.mjs`, `server/voice/supertonic-tts-worker.mjs` | STT readiness/restart session wrapper, native worker lifecycle, and synthesis. |

## Dependency Direction

- UI may depend on browser runtime types and UI components.
- Browser runtime sends settings/events over the wire, but does not know server internals.
- `tool-result-wire.ts` owns browser-side validation for source-card events; UI components render validated data only.
- `server/voice-server.mjs` composes modules; focused modules should not import it.
- Voice modules should stay single-purpose and expose small functions/classes.
- `turn-runtime.mjs` owns active turn acceptance, cancellation, queued speech accounting, and history commit timing.
- `session-history.mjs` owns compact memory, rolling summaries, and web-grounding metadata; prompt builders consume its messages, not its internal state.
- `tool-selector.mjs` owns turn-level routing decisions; policy files provide static matching data, and tool registry owns executable tool namespaces.
- Tool code owns external API shapes and should return compact structured objects.
- MCP facades validate external payloads with explicit schemas before normalizing them into compact tool results.
- `tool-source-card.mjs` owns user-facing source panel event shaping. Tools may return structured `sections`; UI renders those sections directly and must not parse raw tool payloads.
- Model-facing tool schemas should keep invalid states small: use explicit required fields, `additionalProperties: false`, and server-owned defaults for caps or runtime context.
- `turn-logging.mjs` owns the canonical per-turn observability event; route decisions must be mirrored into structured `tool_route_*` fields instead of existing only in freeform runtime logs.
- TTS pronunciation fixes belong in `speech-normalization.mjs`, backed by tests.

## Behavior Invariants

- Barge-in cancels the active turn and restarts STT.
- Only one active browser client is accepted at a time.
- After the browser sends settings for a new session, the server starts one synthetic opening turn when auto greeting is enabled so the assistant speaks first; this turn uses normal TTS/cancellation plumbing but is not committed to conversation memory.
- Empty, filler, silence, or background-noise transcripts do not create LLM turns.
- Repeat requests replay the last committed assistant answer without a new tool or LLM turn.
- Conversation memory keeps recent useful turns verbatim and rolls overflowed turns into a bounded system summary instead of silently dropping older context.
- Tool routing is deterministic before generation: local date/time tools run before MCP or web, MCP routes require explicit private-system signals, web routes are selected by `tool-selector.mjs`, and the final answer model does not silently override the selected route.
- Every non-ignored turn records the selected route kind, category, selected tools, web-follow-up flag, and query length in its final `voice_turn` log event.
- Web tools run only when enabled by settings and selected by the routing policy.
- MCP tools run only when configured in the server environment and selected by explicit private-system routing policy.
- Web follow-ups after a web-grounded turn must carry explicit mutable-fact or source/reference signals; ambiguous related-topic, pronunciation, or meta-speech follow-ups stay off the web path.
- Tool answers must be grounded in returned tool results.
- Tool-planning prompts and internal no-tool sentinels are never reused as final-answer context or spoken to the user.
- Tool result events sent to the browser use a compact source-card contract: provider, title, sections, result items, and sources. Tracker issue lookups expose human sections such as `About`, `Latest decision`, and `Context`; web lookups expose `Key findings`.
- SmolLM3 tool calls use XML-wrapped JSON in `<tool_call>...</tool_call>`; tool results are returned as compact JSON user messages because this local llama.cpp/SmolLM3 path does not provide hosted OpenAI call IDs or strict tool-result roles.
- If a selected web route cannot run, the turn fails predictably instead of falling back to stale model memory.
- User-facing speech should avoid Markdown, JSON, XML, raw URLs, and tool names.
- Selected language is authoritative for final answers and tool bridges.

## Verification

- Run `bun run check` after code changes.
- Run `bun run build` after frontend or bundling changes.
- For manual voice QA, exercise the behavior invariants above: silence/no-op handling, unclear Russian clarification, explicit web grounding, web tool failure, pronunciation normalization, barge-in, and repeat replay.
