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
			const provider = toolActivityProvider(name);
			if (provider) {
				turn.activeToolProvider = provider;
				sendToolState({ active, name });
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

function toolActivityProvider(name) {
	if (name.startsWith("web_")) return "web";
	if (name.startsWith("yandex_tracker_")) return "yandex-tracker";
	return undefined;
}
