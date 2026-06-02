import { ExternalLink, XIcon } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from "@/components/ui/sheet";
import type { ToolResultSummary } from "./app-types";
import { Icons } from "./icons";

interface SourceSheetProps {
	open: boolean;
	result: ToolResultSummary | null;
	onOpenChange: (open: boolean) => void;
}

export function SourceSheet({ open, result, onOpenChange }: SourceSheetProps) {
	const desktop = useMediaQuery("(min-width: 900px)");
	if (desktop) {
		return (
			<div
				aria-hidden={!open}
				className="source-docked-viewport"
				style={{ width: "var(--source-panel-width)" }}
			>
				<aside
					className={`source-docked-panel group/docked-sheet ${open ? "is-open" : ""}`}
					aria-label="Sources"
					style={{ width: "var(--source-panel-width)" }}
				>
					<SourcePanel result={result} onClose={() => onOpenChange(false)} />
				</aside>
			</div>
		);
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="w-[min(420px,100vw)] gap-0 overflow-hidden p-0 sm:max-w-[420px]"
			>
				<SheetTitle className="sr-only">
					{result?.title ?? "Sources"}
				</SheetTitle>
				<SheetDescription className="sr-only">
					{result?.query ? `Query: ${result.query}` : "Latest tool result"}
				</SheetDescription>
				<SourcePanel result={result} />
			</SheetContent>
		</Sheet>
	);
}

function SourcePanel({
	result,
	onClose,
}: {
	result: ToolResultSummary | null;
	onClose?: () => void;
}) {
	const sections = result?.sections ?? [];
	return (
		<>
			<header className="source-panel-header">
				<div className="source-panel-title">
					{result && <ProviderIcon result={result} />}
					{result && <h2>{result.title}</h2>}
				</div>
			</header>
			{onClose && (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="source-panel-close"
					onClick={onClose}
				>
					<XIcon />
					<span className="sr-only">Close</span>
				</Button>
			)}
			<div className="source-panel-body">
				{!result && (
					<div className="source-empty">
						<h2>No sources yet</h2>
						<p>
							Web and Yandex Tracker results will appear here after a tool
							finishes.
						</p>
					</div>
				)}

				{result && (
					<>
						{sections.length > 0 && (
							<section className="source-result">
								<div className="source-result-lines">
									{sections.map((line) => (
										<p key={line.label} className="source-result-line">
											<span>{line.label}</span>
											{line.text}
										</p>
									))}
								</div>
							</section>
						)}

						{result.sources.length > 0 && (
							<section className="source-links">
								<h2 className="source-links-title">Sources</h2>
								<div className="flex flex-col gap-0.5">
									{result.sources.map((source) => (
										<SourceRow
											key={`${source.title}:${source.url ?? ""}`}
											source={source}
										/>
									))}
								</div>
							</section>
						)}
					</>
				)}
			</div>
		</>
	);
}

function ProviderIcon({ result }: { result: ToolResultSummary }) {
	if (result.provider === "yandex-tracker") {
		const YandexTrackerLogo = Icons.yandexTrackerLogo;
		return <YandexTrackerLogo className="size-4 text-blue-600" />;
	}
	return null;
}

function SourceRow({
	source,
}: {
	source: ToolResultSummary["sources"][number];
}) {
	if (!source.url) {
		return <div className="source-link-static">{source.title}</div>;
	}

	return (
		<a
			href={source.url}
			target="_blank"
			rel="noreferrer"
			className="source-link-row"
		>
			<span>{source.title}</span>
			<ExternalLink />
		</a>
	);
}

function useMediaQuery(query: string) {
	const [matches, setMatches] = React.useState(() =>
		typeof window === "undefined" ? false : window.matchMedia(query).matches,
	);

	React.useEffect(() => {
		const media = window.matchMedia(query);
		const handleChange = () => setMatches(media.matches);
		handleChange();
		media.addEventListener("change", handleChange);
		return () => media.removeEventListener("change", handleChange);
	}, [query]);

	return matches;
}
