# Architecture

Cast is a local speech-to-speech app with one maintained runtime path.

## Runtime Flow

```text
browser mic PCM
-> WebSocket voice server
-> Silero VAD + Parakeet STT worker
-> SmolLM3 via llama.cpp
-> optional Ollama web tools
-> Supertonic 3 TTS
-> browser PCM playback
```

## Layers

| Layer | Files | Owns |
| --- | --- | --- |
| UI | `web/src/app-ui.tsx`, `web/src/styles.css` | Screens, controls, visual state. |
| Browser runtime | `web/src/main.tsx`, `web/src/voice-wire.ts`, `web/src/voice-agent-config.ts` | Mic capture, playback, WebSocket protocol, settings payload, active agent instructions. |
| Server runtime | `server/voice-server.mjs` | Turn lifecycle orchestration, cancellation, STT/LLM/TTS/tool wiring. |
| AI policy | `server/ai/prompts.mjs`, `web/src/voice-agent-config.ts` | Prompt shape and active agent instructions. |
| Voice policy | `server/voice/realtime-voice-patterns.mjs` | Silence/no-op handling and tool preambles. |
| LLM | `server/voice/llama.mjs`, `server/voice/tool-loop.mjs`, `server/voice/web-intent.mjs` | llama.cpp requests, tool-call loop, web gate. |
| Tools | `server/ai/tools/ollama-web-tools.mjs` | Ollama web search/fetch boundary and payload caps. |
| Speech text | `server/voice/text.mjs`, `server/voice/speech-normalization.mjs` | LLM cleanup, chunking, pronunciation normalization. |
| STT/TTS workers | `server/voice/stt-worker.mjs`, `server/voice/supertonic-tts-worker.mjs` | Native worker lifecycle and synthesis. |

## Dependency Direction

- UI may depend on browser runtime types and UI components.
- Browser runtime sends settings/events over the wire, but does not know server internals.
- `server/voice-server.mjs` composes modules; focused modules should not import it.
- Voice modules should stay single-purpose and expose small functions/classes.
- Tool code owns external API shapes and should return compact structured objects.
- TTS pronunciation fixes belong in `speech-normalization.mjs`, backed by tests.

## Behavior Invariants

- Barge-in cancels the active turn and restarts STT.
- Empty, filler, silence, or background-noise transcripts do not create LLM turns.
- Web tools run only when enabled and the deterministic gate passes.
- Tool answers must be grounded in returned tool results.
- User-facing speech should avoid Markdown, JSON, XML, raw URLs, and tool names.
- Selected language is authoritative for final answers and tool bridges.

## Verification

- Run `bun run check` after code changes.
- Run `bun run build` after frontend or bundling changes.
- Use `docs/voice-regression-scenarios.md` for manual voice QA.
