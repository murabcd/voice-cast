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
			if (name.startsWith("web_")) {
				turn.webSearchActive = true;
				sendToolState({ active, name });
			}
			return;
		}
		if (!turn.webSearchActive) sendToolState({ active: false, name });
	};
}

export function resetToolActivity({ turn, sendToolState }) {
	if (turn.webSearchActive) turn.webSearchActive = false;
	sendToolState({ active: false });
}
