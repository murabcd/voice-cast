export function measureMessages(messages) {
	const buckets = {
		assistant: 0,
		system: 0,
		tool: 0,
		user: 0,
	};
	for (const message of Array.isArray(messages) ? messages : []) {
		const role = message?.role;
		const chars = String(message?.content ?? "").length;
		if (role === "assistant") buckets.assistant += chars;
		else if (role === "system") buckets.system += chars;
		else if (role === "user" && isToolResultMessage(message.content))
			buckets.tool += chars;
		else if (role === "user") buckets.user += chars;
	}
	const total =
		buckets.assistant + buckets.system + buckets.tool + buckets.user;
	return {
		messages: Array.isArray(messages) ? messages.length : 0,
		totalChars: total,
		systemChars: buckets.system,
		userChars: buckets.user,
		assistantChars: buckets.assistant,
		toolResultChars: buckets.tool,
	};
}

function isToolResultMessage(content) {
	return String(content ?? "").includes('"type":"tool_results"');
}
