import { ExternalLink, XIcon } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/components/ui/drawer";
import type { ToolResultSummary } from "./app-types";
import { Icons } from "./icons";

interface SourceSheetProps {
	open: boolean;
	result: ToolResultSummary | null;
	onOpenChange: (open: boolean) => void;
}

const sourcePanelWidthStorageKey = "voice-cast.source-panel-width";
const sourcePanelWidthCssVariable = "--source-panel-width-current";
const defaultSourcePanelWidth = 256;
const minSourcePanelWidth = 240;
const maxSourcePanelWidth = 560;
const minMainContentWidth = 420;
const keyboardResizeStep = 24;

export function SourceSheet({ open, result, onOpenChange }: SourceSheetProps) {
	const desktop = useMediaQuery("(min-width: 900px)");
	const { handleResizeKeyDown, handleResizeStart, isResizing, panelWidth } =
		useResizableSourcePanel(desktop);

	if (desktop) {
		return (
			<div
				aria-hidden={!open}
				className="source-docked-viewport"
				style={{ width: panelWidth }}
			>
				<aside
					className={`source-docked-panel group/docked-sheet ${open ? "is-open" : ""} ${isResizing ? "is-resizing" : ""}`}
					aria-label="Sources"
					style={{ width: panelWidth }}
				>
					<button
						type="button"
						aria-label="Resize sources panel"
						title={`Resize sources panel: ${Math.round(panelWidth)}px`}
						className="source-panel-resize-handle"
						onPointerDown={handleResizeStart}
						onKeyDown={handleResizeKeyDown}
					>
						<span className="source-panel-resize-grip" />
					</button>
					<SourcePanel result={result} onClose={() => onOpenChange(false)} />
				</aside>
			</div>
		);
	}

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent className="source-drawer">
				<DrawerTitle className="sr-only">
					{result?.title ?? "Sources"}
				</DrawerTitle>
				<DrawerDescription className="sr-only">
					{result?.query ? `Query: ${result.query}` : "Latest tool result"}
				</DrawerDescription>
				<SourcePanel result={result} />
			</DrawerContent>
		</Drawer>
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
										<SourceSection key={line.label} section={line} />
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

function SourceSection({
	section,
}: {
	section: ToolResultSummary["sections"][number];
}) {
	return (
		<section className="source-result-section">
			<h3>{section.label}</h3>
			<p className="source-result-text">{sourcePreviewText(section.text)}</p>
		</section>
	);
}

function sourcePreviewText(text: string) {
	const maxLength = 900;
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength).trim()}...`;
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

function useResizableSourcePanel(enabled: boolean) {
	const [viewportWidth, setViewportWidth] = React.useState(() =>
		typeof window === "undefined" ? 1024 : window.innerWidth,
	);
	const bounds = React.useMemo(
		() => sourcePanelWidthBounds(viewportWidth),
		[viewportWidth],
	);
	const [panelWidth, setPanelWidth] = React.useState(() =>
		clamp(defaultSourcePanelWidth, bounds.min, bounds.max),
	);
	const panelWidthRef = React.useRef(panelWidth);
	const grabOffsetRef = React.useRef(0);
	const pendingWidthRef = React.useRef<number | null>(null);
	const animationFrameRef = React.useRef<number | null>(null);
	const [isResizing, setIsResizing] = React.useState(false);

	const commitPanelWidth = React.useCallback((nextWidth: number) => {
		if (animationFrameRef.current !== null) {
			window.cancelAnimationFrame(animationFrameRef.current);
			animationFrameRef.current = null;
		}
		pendingWidthRef.current = null;
		panelWidthRef.current = nextWidth;
		setPanelWidth((currentWidth) =>
			currentWidth === nextWidth ? currentWidth : nextWidth,
		);
	}, []);

	const schedulePanelWidth = React.useCallback((nextWidth: number) => {
		pendingWidthRef.current = nextWidth;
		if (animationFrameRef.current !== null) return;
		animationFrameRef.current = window.requestAnimationFrame(() => {
			animationFrameRef.current = null;
			const pendingWidth = pendingWidthRef.current;
			pendingWidthRef.current = null;
			if (pendingWidth === null) return;
			panelWidthRef.current = pendingWidth;
			setPanelWidth((currentWidth) =>
				currentWidth === pendingWidth ? currentWidth : pendingWidth,
			);
		});
	}, []);

	const persistPanelWidth = React.useCallback((nextWidth: number) => {
		try {
			window.localStorage.setItem(
				sourcePanelWidthStorageKey,
				String(Math.round(nextWidth)),
			);
		} catch {}
	}, []);

	React.useEffect(() => {
		panelWidthRef.current = panelWidth;
		if (typeof document === "undefined") return;
		document.documentElement.style.setProperty(
			sourcePanelWidthCssVariable,
			`${Math.round(panelWidth)}px`,
		);
	}, [panelWidth]);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const handleResize = () => setViewportWidth(window.innerWidth);
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	React.useEffect(() => {
		if (!enabled || typeof window === "undefined") return;
		const storedValue = window.localStorage.getItem(sourcePanelWidthStorageKey);
		const storedWidth = storedValue ? Number.parseFloat(storedValue) : NaN;
		const nextWidth = Number.isFinite(storedWidth)
			? storedWidth
			: defaultSourcePanelWidth;
		commitPanelWidth(clamp(nextWidth, bounds.min, bounds.max));
	}, [bounds, commitPanelWidth, enabled]);

	React.useEffect(() => {
		commitPanelWidth(clamp(panelWidthRef.current, bounds.min, bounds.max));
	}, [bounds, commitPanelWidth]);

	React.useEffect(() => {
		const animationFrameId = animationFrameRef.current;
		return () => {
			if (animationFrameId !== null) {
				window.cancelAnimationFrame(animationFrameId);
			}
		};
	}, []);

	React.useEffect(() => {
		if (!isResizing || typeof document === "undefined") return;
		const previousBodyStyle = document.body.getAttribute("style");
		const previousResizingState =
			document.documentElement.dataset.sourcePanelResizing;
		document.body.setAttribute(
			"style",
			`${previousBodyStyle ?? ""}; user-select: none; cursor: col-resize;`,
		);
		document.documentElement.dataset.sourcePanelResizing = "true";
		return () => {
			if (previousBodyStyle === null) {
				document.body.removeAttribute("style");
			} else {
				document.body.setAttribute("style", previousBodyStyle);
			}
			if (previousResizingState === undefined) {
				delete document.documentElement.dataset.sourcePanelResizing;
				return;
			}
			document.documentElement.dataset.sourcePanelResizing =
				previousResizingState;
		};
	}, [isResizing]);

	const resizeToClientX = React.useCallback(
		(clientX: number, strategy: "commit" | "schedule") => {
			const nextWidth = clamp(
				window.innerWidth - clientX + grabOffsetRef.current,
				bounds.min,
				bounds.max,
			);
			if (strategy === "commit") {
				commitPanelWidth(nextWidth);
				return;
			}
			schedulePanelWidth(nextWidth);
		},
		[bounds, commitPanelWidth, schedulePanelWidth],
	);

	const finishResize = React.useCallback(() => {
		const pendingWidth = pendingWidthRef.current;
		const nextWidth = pendingWidth ?? panelWidthRef.current;
		if (pendingWidth !== null) commitPanelWidth(pendingWidth);
		persistPanelWidth(nextWidth);
		grabOffsetRef.current = 0;
		delete document.documentElement.dataset.sourcePanelResizingPending;
		setIsResizing(false);
	}, [commitPanelWidth, persistPanelWidth]);

	const handleResizeStart = React.useCallback(
		(event: React.PointerEvent<HTMLButtonElement>) => {
			if (!enabled || (event.pointerType !== "touch" && event.button !== 0))
				return;
			event.preventDefault();
			event.stopPropagation();
			event.currentTarget.setPointerCapture?.(event.pointerId);
			document.documentElement.dataset.sourcePanelResizingPending = "true";
			grabOffsetRef.current =
				panelWidthRef.current - (window.innerWidth - event.clientX);
			setIsResizing(true);

			const handlePointerMove = (pointerEvent: PointerEvent) => {
				resizeToClientX(pointerEvent.clientX, "schedule");
			};
			const handlePointerEnd = () => {
				window.removeEventListener("pointermove", handlePointerMove);
				window.removeEventListener("pointerup", handlePointerEnd);
				window.removeEventListener("pointercancel", handlePointerEnd);
				finishResize();
			};

			window.addEventListener("pointermove", handlePointerMove);
			window.addEventListener("pointerup", handlePointerEnd);
			window.addEventListener("pointercancel", handlePointerEnd);
		},
		[enabled, finishResize, resizeToClientX],
	);

	const handleResizeKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLButtonElement>) => {
			let nextWidth: number | null = null;
			switch (event.key) {
				case "ArrowLeft":
					nextWidth = panelWidth + keyboardResizeStep;
					break;
				case "ArrowRight":
					nextWidth = panelWidth - keyboardResizeStep;
					break;
				case "Home":
					nextWidth = bounds.min;
					break;
				case "End":
					nextWidth = bounds.max;
					break;
				default:
					return;
			}
			event.preventDefault();
			const clampedWidth = clamp(nextWidth, bounds.min, bounds.max);
			commitPanelWidth(clampedWidth);
			persistPanelWidth(clampedWidth);
		},
		[bounds, commitPanelWidth, panelWidth, persistPanelWidth],
	);

	return {
		handleResizeKeyDown,
		handleResizeStart,
		isResizing,
		panelWidth,
	};
}

function sourcePanelWidthBounds(viewportWidth: number) {
	const maxWidth = Math.max(
		minSourcePanelWidth,
		Math.min(maxSourcePanelWidth, viewportWidth - minMainContentWidth),
	);
	return {
		min: Math.min(minSourcePanelWidth, maxWidth),
		max: maxWidth,
	};
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
