# Voice Regression Scenarios

Run these after changes to STT, prompt policy, tool use, TTS, or barge-in.

| Area | Scenario | Expected behavior |
| --- | --- | --- |
| Silence | Start a conversation, say nothing, then stop talking. | No unrelated answer. App stays in hearing mode. |
| Unclear audio | Speak a cut-off or noisy Russian phrase. | One short clarification in Russian, no tool call. |
| Russian mode | Select Russian and ask a Russian question with an English product name. | Reply stays in Russian. Product name is pronounced naturally. |
| Direct answer | Ask `когда были первые пожарные?` with web tools on. | No web search unless explicitly requested. Short Russian answer. |
| Explicit web | Ask `проверь в интернете последнюю версию SmolLM3`. | Brief Russian bridge, globe appears, web tool runs, answer cites only verified result in speech-friendly form. |
| Tool failure | Ask for a fresh fact while network/API is unavailable. | No guessing. Briefly says it could not verify. |
| Pronunciation | Ask about `создание виджетов для цифровых каналов`. | Says `ви́джетов` and `цифровы́х` correctly. |
| Barge-in | Interrupt while the assistant is speaking. | Speech stops quickly, STT restarts, new user turn wins. |
| Repetition | Ask several web questions in a row. | Bridge phrases vary and do not sound robotic. |
