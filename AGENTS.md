# Repository Guidelines

## Project Structure & Module Organization
`cast` is a Bun app for local speech-to-speech conversation on Apple Silicon. `web/src` owns the Vite + React browser UI, microphone capture, playback, settings, and WebSocket client behavior. `web/src/voice-agent-config.ts` owns browser-side agent instructions. `server/voice-server.mjs` owns runtime orchestration across STT, LLM, tools, TTS, cancellation, and turn lifecycle. AI prompt and tool boundaries live in `server/ai`, following the `prompts` and `tools` split. Focused voice runtime modules live in `server/voice`; keep web gating, tool loops, speech cleanup, pronunciation normalization, and worker adapters there instead of growing the runtime file. Native STT/VAD code lives in `native`; local model artifacts live in `models` and should not be treated as application logic. Voice QA scenarios live in `docs/voice-regression-scenarios.md`, and architecture boundaries live in `docs/ARCHITECTURE.md`.

## Core Priorities
1. Low latency voice interaction.
2. Reliable turn lifecycle, cancellation, and barge-in.
3. Predictable behavior under failures, partial streams, silence, restarts, and reconnects.

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability
Long term maintainability is a core priority. Before adding local logic, check whether the behavior belongs in an existing focused module under `server/voice` or should be extracted into a new one. Duplicate logic across multiple files is a code smell. Do not preserve old fallback paths when the product has a single intended runtime path. Do not add comments as a substitute for clear structure, names, tests, or docs.

## Build, Test, and Development Commands
Run `bun install` once at the repo root. Use `bun run dev` to start the full local stack: Vite on `127.0.0.1:3000`, the voice WebSocket server on `127.0.0.1:8090`, and llama.cpp on `127.0.0.1:18081`. Use `bun run dev:web`, `bun run dev:voice`, or `bun run dev:llm` for individual services. Use `bun run build` for the frontend build, `bun run test` for Vitest, `bun run typecheck` for TypeScript, `bun run lint` for non-mutating Biome validation, and `bun run check` for the full validation pipeline. Use `bun run format` only when you intentionally want Biome to rewrite files.

## Coding Style & Naming Conventions
Biome is the formatter and linter (`biome.json`). Use tabs for indentation, double quotes for JavaScript/TypeScript, and let Biome organize imports. Runtime server files use ESM `.mjs`; frontend files use TypeScript and React. React components use PascalCase exports, hooks use camel case, and focused voice modules use descriptive kebab-case filenames such as `speech-normalization.mjs`. Keep UI primitives in `web/src/components/ui` and avoid duplicating component patterns inside feature code.

## Code Quality
Avoid `any` types unless they are absolutely necessary and locally justified. Before guessing external API shapes, check the dependency's installed type definitions under `node_modules` and use the exported types. Never use inline imports: do not write `await import("./foo.js")` for runtime code or `import("pkg").Type` in type positions. Use standard top-level imports for runtime values and `import type` declarations for types. Parse data shapes at external boundaries instead of relying on ad hoc property access. Keep tool outputs compact and structured. Keep `server/voice-server.mjs` as orchestration, not a dumping ground for policy, text processing, or tool-specific logic.

## Testing Guidelines
Unit tests use Vitest and live beside the behavior they cover, usually as `server/voice/*.test.mjs`. Add tests for nontrivial prompt policy helpers, web gating, tool parsing, text cleanup, pronunciation normalization, and turn lifecycle behavior. Run `bun run check` before handing off changes. For frontend changes, run `bun run build` when layout, bundling, or client runtime behavior changed. Voice behavior that cannot be fully automated should update or reference `docs/voice-regression-scenarios.md`.

## Commit & Pull Request Guidelines
Use Conventional Commits such as `feat: ...`, `fix: ...`, `docs: ...`, and `test: ...`. Keep commit subjects lowercase, imperative, and scoped to one change. PRs should include a short summary, verification steps, and screenshots or recordings for visible UI or voice-flow changes. Call out model, prompt, tool, `.env`, or voice pipeline changes explicitly because they affect manual testing.

## Security & Configuration Tips
Keep secrets in `.env`; do not commit local env files. Review `.env.example` when adding configuration. `OLLAMA_API_KEY` enables hosted web search/fetch; the app should still start without it, with web tools disabled. Never log secrets, raw API keys, or unnecessary user audio data. Keep local model paths configurable through the existing config layer.
