export interface BargeInDetectorOptions {
	framesRequired: number;
	releaseMs: number;
	rmsThreshold: number;
	now?: () => number;
}

export interface BargeInDecision {
	allowMicFrame: boolean;
	shouldCancelPlayback: boolean;
	shouldSendBargeIn: boolean;
}

export function createBargeInDetector({
	framesRequired,
	releaseMs,
	rmsThreshold,
	now = () => performance.now(),
}: BargeInDetectorOptions) {
	let frames = 0;
	let sent = false;
	let releasedUntil = 0;

	function reset() {
		frames = 0;
		sent = false;
		releasedUntil = 0;
	}

	return {
		reset,
		evaluate({
			assistantActive,
			rms,
		}: {
			assistantActive: boolean;
			rms: number;
		}): BargeInDecision {
			if (assistantActive) {
				if (rms > rmsThreshold) {
					frames += 1;
					if (!sent && frames >= framesRequired) {
						sent = true;
						releasedUntil = now() + releaseMs;
						return {
							allowMicFrame: false,
							shouldCancelPlayback: true,
							shouldSendBargeIn: true,
						};
					}
				} else {
					frames = Math.max(0, frames - 1);
				}
				if (!sent)
					return {
						allowMicFrame: false,
						shouldCancelPlayback: false,
						shouldSendBargeIn: false,
					};
			}

			return {
				allowMicFrame: now() >= releasedUntil,
				shouldCancelPlayback: false,
				shouldSendBargeIn: false,
			};
		},
	};
}
