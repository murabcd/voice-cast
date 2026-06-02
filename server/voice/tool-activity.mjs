import { toolProvider } from "./tool-provider.mjs";

export function createToolActivityHandler({
	turn,
	canAccept,
	recordToolCall,
	sendToolState,
}) {
	return ({ active, name }) => {
		if (!canAccept()) return;
		if (active && name) {
			recordToolCall(turn, name);
			const provider = toolProvider(name);
			if (provider) {
				turn.activeToolProvider = provider;
				sendToolState({ active, name, provider });
			}
			return;
		}
		if (!turn.activeToolProvider) sendToolState({ active: false, name });
	};
}

export function resetToolActivity({ turn, sendToolState }) {
	if (turn.activeToolProvider) turn.activeToolProvider = undefined;
	sendToolState({ active: false });
}
