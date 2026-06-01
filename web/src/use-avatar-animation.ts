import React from "react";
import type { Phase } from "./app-types";

interface AvatarAnimationOptions {
	phase: Phase;
	playbackAnalyser: AnalyserNode | null;
	previewAnimation: boolean;
}

const speechNoiseFloor = 0.003;
const speechSensitivity = 18;

function clamp01(value: number) {
	return Math.max(0, Math.min(1, value));
}

function readAnalyserRms(analyser: AnalyserNode) {
	const samples = new Uint8Array(analyser.fftSize);
	analyser.getByteTimeDomainData(samples);
	let sum = 0;
	for (const sample of samples) {
		const centered = (sample - 128) / 128;
		sum += centered * centered;
	}
	return Math.sqrt(sum / samples.length);
}

export function useAvatarAnimation({
	phase,
	playbackAnalyser,
	previewAnimation,
}: AvatarAnimationOptions) {
	const [jawOpen, setJawOpen] = React.useState(0);
	const [listeningEnergy, setListeningEnergy] = React.useState(0);
	const jawRafRef = React.useRef(0);
	const jawOpenRef = React.useRef(0);
	const previewRafRef = React.useRef(0);
	const listeningEnergyRef = React.useRef(0);
	const listeningReleaseRafRef = React.useRef(0);
	const phaseRef = React.useRef(phase);

	phaseRef.current = phase;

	const updateListeningMeter = React.useCallback((rms: number) => {
		if (phaseRef.current !== "hearing") return;
		const target = clamp01((rms - 0.01) * 18);
		listeningEnergyRef.current =
			listeningEnergyRef.current * 0.72 + target * 0.28;
		setListeningEnergy(listeningEnergyRef.current);
	}, []);

	React.useEffect(() => {
		if (!playbackAnalyser || previewAnimation) return;
		const tick = () => {
			const rms = readAnalyserRms(playbackAnalyser);
			const fallback =
				phaseRef.current === "speaking"
					? 0.08 + Math.sin(performance.now() / 58) * 0.035
					: 0;
			const target = Math.max(
				fallback,
				clamp01((rms - speechNoiseFloor) * speechSensitivity),
			);
			jawOpenRef.current = jawOpenRef.current * 0.54 + target * 0.46;
			setJawOpen(jawOpenRef.current);
			jawRafRef.current = requestAnimationFrame(tick);
		};
		jawRafRef.current = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(jawRafRef.current);
			jawRafRef.current = 0;
			jawOpenRef.current = 0;
			setJawOpen(0);
		};
	}, [playbackAnalyser, previewAnimation]);

	React.useEffect(() => {
		if (!previewAnimation) return;
		const startedAt = performance.now();
		const tick = (now: number) => {
			const elapsed = (now - startedAt) / 1000;
			const pulse =
				Math.max(0, Math.sin(elapsed * 12)) * 0.68 +
				Math.max(0, Math.sin(elapsed * 21)) * 0.32;
			setJawOpen(pulse);
			previewRafRef.current = requestAnimationFrame(tick);
		};
		previewRafRef.current = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(previewRafRef.current);
			previewRafRef.current = 0;
			setJawOpen(0);
		};
	}, [previewAnimation]);

	React.useEffect(() => {
		if (phase === "hearing") return;
		const release = () => {
			listeningEnergyRef.current *= 0.7;
			const next =
				listeningEnergyRef.current < 0.02 ? 0 : listeningEnergyRef.current;
			listeningEnergyRef.current = next;
			setListeningEnergy(next);
			if (next > 0)
				listeningReleaseRafRef.current = requestAnimationFrame(release);
		};
		listeningReleaseRafRef.current = requestAnimationFrame(release);
		return () => cancelAnimationFrame(listeningReleaseRafRef.current);
	}, [phase]);

	React.useEffect(
		() => () => {
			cancelAnimationFrame(jawRafRef.current);
			cancelAnimationFrame(previewRafRef.current);
			cancelAnimationFrame(listeningReleaseRafRef.current);
		},
		[],
	);

	return {
		avatarIsListening: phase === "hearing" && listeningEnergy > 0.025,
		avatarIsSpeaking: phase === "speaking" || previewAnimation,
		jawOpen,
		listeningEnergy,
		updateListeningMeter,
	};
}
