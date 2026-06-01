# Voice STT worker

Native speech-to-text worker for Cast.

It reads length-prefixed 16-bit little-endian mono PCM frames from stdin and emits newline-delimited JSON events for speech activity and finalized transcripts.

## Build

```bash
cargo build --release --manifest-path native/voice-stt-worker/Cargo.toml
```

The app server starts the worker automatically from:

```text
native/voice-stt-worker/target/release/voice-stt-worker
```

## Model

The worker expects the Parakeet TDT int8 ONNX files in:

```text
models/parakeet-tdt-0.6b-v3-onnx-int8/
  encoder-model.int8.onnx
  decoder_joint-model.int8.onnx
  vocab.txt
```

## Runtime knobs

```bash
PARAKEET_ENERGY_GATE=0.002
PARAKEET_INTERIM_INTERVAL_MS=0
```

## Packaging notes

The worker is a native executable. ONNX Runtime provisioning is handled by the `ort`/`ort-sys` build, which downloads and links the matching runtime for the target platform. On the current macOS arm64 build, `otool -L target/release/voice-stt-worker` shows no external `libonnxruntime.dylib` dependency; system frameworks are sufficient.

The embedded VAD model and local `voice_activity_detector` crate are adapted from `nkeenan38/voice_activity_detector` to use the same `ort` version as `parakeet-rs`.
