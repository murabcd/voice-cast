# Cartoon Voice

Local Russian speech-to-speech voice app for Apple Silicon.

Cartoon Voice runs the complete conversation loop on your machine: browser microphone input, native speech recognition, local LLM replies, and local speech synthesis.

## Features

- Continuous browser voice chat with barge-in interruption.
- Native Parakeet speech recognition worker with Silero VAD.
- llama.cpp OpenAI-compatible local chat server.
- Supertonic 3 local Russian speech synthesis.
- Single maintained runtime path with no Python service or legacy TTS fallbacks.

## Runtime

```text
browser mic PCM
-> Node WebSocket server
-> Rust Silero VAD + Parakeet ONNX STT
-> llama.cpp OpenAI-compatible chat server
-> Supertonic 3 TTS
-> browser PCM playback
```

## Models

- STT: `models/parakeet-tdt-0.6b-v3-onnx-int8`
- LLM: `models/llm/smollm3-3b/HuggingFaceTB_SmolLM3-3B-Q4_K_M.gguf`
- TTS: `models/supertonic-3`

## Running locally

```bash
bun run dev
```

Open:

```text
http://localhost:3000
```

`bun run dev` starts:

- Vite web app on `127.0.0.1:3000`
- Node voice WebSocket server on `127.0.0.1:8090`
- llama.cpp server on `127.0.0.1:18081`

## Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start the web app, voice server, and llama.cpp server. |
| `bun run dev:web` | Start only the Vite web app. |
| `bun run dev:voice` | Start only the Node voice server. |
| `bun run dev:llm` | Start only the llama.cpp server. |
| `bun run check` | Run Biome, TypeScript, Node syntax checks, and tests. |
| `bun run build` | Build the web app. |

## Verification

```bash
bun run check
bun run build
```
