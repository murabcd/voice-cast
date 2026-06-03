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
import { cn } from "./lib/utils";

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
				className="pointer-events-none fixed top-0 right-0 z-30 h-screen overflow-hidden"
				style={{ width: panelWidth }}
			>
				<aside
					className={cn(
						"group/docked-sheet relative flex h-svh flex-col overflow-hidden border-l border-border bg-background text-foreground transition-transform duration-200 ease-linear",
						open
							? "pointer-events-auto translate-x-0"
							: "pointer-events-none translate-x-full",
						isResizing && "is-resizing transition-none",
						"[[data-source-panel-resizing=true]_&]:transition-none",
					)}
					aria-label="Sources"
					style={{ width: panelWidth }}
				>
					<button
						type="button"
						aria-label="Resize sources panel"
						title={`Resize sources panel: ${Math.round(panelWidth)}px`}
						className="absolute inset-y-0 -left-2.5 z-5 flex w-5 !cursor-col-resize touch-none items-center justify-center border-0 bg-transparent text-[#050505]/45 opacity-0 transition-[opacity,color] duration-150 ease-out hover:!cursor-col-resize hover:text-[#050505]/60 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-3 focus-visible:outline-[#050505] group-hover/docked-sheet:opacity-100 group-focus-within/docked-sheet:opacity-100 [.is-resizing_&]:opacity-100 [.is-resizing_&]:text-[#050505]/60 [&_span]:h-[72px] [&_span]:w-[5px] [&_span]:rounded-full [&_span]:bg-[#050505]/7 [&_span]:transition-[background,width] [&_span]:duration-150 [&_span]:ease-out hover:[&_span]:w-1.5 hover:[&_span]:bg-[#050505]/12 focus-visible:[&_span]:w-1.5 focus-visible:[&_span]:bg-[#050505]/12 [.is-resizing_&>span]:w-1.5 [.is-resizing_&>span]:bg-[#050505]/12"
						onPointerDown={handleResizeStart}
						onKeyDown={handleResizeKeyDown}
					>
						<span />
					</button>
					<SourcePanel result={result} onClose={() => onOpenChange(false)} />
				</aside>
			</div>
		);
	}

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent className="max-h-[min(82svh,680px)] gap-0 overflow-hidden rounded-t-[18px]">
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
			<header className="flex min-h-[70px] items-start gap-4 px-[22px] pt-[22px] pr-[52px]">
				<div className="flex min-h-8 min-w-0 flex-1 items-center gap-2 [&_h2]:m-0 [&_h2]:min-w-0 [&_h2]:truncate [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-[#050505]">
					{result && <ProviderIcon result={result} />}
					{result && <h2>{result.title}</h2>}
				</div>
			</header>
			{onClose && (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="absolute top-5 right-[22px]"
					onClick={onClose}
				>
					<XIcon />
					<span className="sr-only">Close</span>
				</Button>
			)}
			<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-[22px] pb-[22px]">
				{!result && (
					<div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 text-center [&_h2]:m-0 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-[#050505] [&_p]:m-0 [&_p]:max-w-[220px] [&_p]:text-[13px] [&_p]:leading-[1.45] [&_p]:text-[#5d5d5d]">
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
							<section className="flex min-w-0 flex-col gap-4">
								<div className="flex min-w-0 flex-col gap-4">
									{sections.map((line) => (
										<SourceSection key={line.label} section={line} />
									))}
								</div>
							</section>
						)}

						{result.sources.length > 0 && (
							<section className="flex min-w-0 flex-col gap-2">
								<h2 className="m-0 text-[13px] leading-[1.2] font-bold text-[#5d5d5d]">
									Sources
								</h2>
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
		<section className="flex min-w-0 flex-col gap-2 [&_h3]:m-0 [&_h3]:text-[13px] [&_h3]:leading-[1.2] [&_h3]:font-bold [&_h3]:text-[#5d5d5d]">
			<h3>{section.label}</h3>
			<p className="m-0 min-w-0 text-sm leading-[1.45] break-words text-[#1f1f1f] [overflow-wrap:anywhere]">
				{sourcePreviewText(section.text)}
			</p>
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
		return (
			<div className="flex min-w-0 items-center gap-2 rounded-lg p-0 text-sm leading-[1.45] break-words text-[#1f1f1f] [overflow-wrap:anywhere]">
				{source.title}
			</div>
		);
	}

	return (
		<a
			href={source.url}
			target="_blank"
			rel="noreferrer"
			className="flex min-w-0 items-center gap-2 rounded-lg p-0 text-sm leading-[1.45] break-words text-[#1f1f1f] no-underline transition-colors duration-140 ease-out hover:text-[#050505] [overflow-wrap:anywhere] [&_span]:min-w-0 [&_span]:flex-1 [&_span]:truncate [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[#5d5d5d]"
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
	const [preferredPanelWidth, setPreferredPanelWidth] = React.useState(
		readPreferredSourcePanelWidth,
	);
	const panelWidth = React.useMemo(
		() => clamp(preferredPanelWidth, bounds.min, bounds.max),
		[preferredPanelWidth, bounds],
	);
	const panelWidthRef = React.useRef(panelWidth);
	const grabOffsetRef = React.useRef(0);
	const pendingWidthRef = React.useRef<number | null>(null);
	const animationFrameRef = React.useRef<number | null>(null);
	const [isResizing, setIsResizing] = React.useState(false);

	const cancelScheduledPanelWidth = React.useCallback(() => {
		if (animationFrameRef.current !== null) {
			window.cancelAnimationFrame(animationFrameRef.current);
		}
		animationFrameRef.current = null;
	}, []);

	const commitPanelWidth = React.useCallback(
		(nextWidth: number) => {
			const clampedWidth = clamp(nextWidth, bounds.min, bounds.max);
			cancelScheduledPanelWidth();
			pendingWidthRef.current = null;
			panelWidthRef.current = clampedWidth;
			setPreferredPanelWidth((currentWidth) =>
				currentWidth === clampedWidth ? currentWidth : clampedWidth,
			);
		},
		[bounds, cancelScheduledPanelWidth],
	);

	const schedulePanelWidth = React.useCallback(
		(nextWidth: number) => {
			pendingWidthRef.current = clamp(nextWidth, bounds.min, bounds.max);
			if (animationFrameRef.current !== null) return;
			animationFrameRef.current = window.requestAnimationFrame(() => {
				animationFrameRef.current = null;
				const pendingWidth = pendingWidthRef.current;
				pendingWidthRef.current = null;
				if (pendingWidth === null) return;
				panelWidthRef.current = pendingWidth;
				setPreferredPanelWidth((currentWidth) =>
					currentWidth === pendingWidth ? currentWidth : pendingWidth,
				);
			});
		},
		[bounds],
	);

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
		return cancelScheduledPanelWidth;
	}, [cancelScheduledPanelWidth]);

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

function readPreferredSourcePanelWidth() {
	if (typeof window === "undefined") return defaultSourcePanelWidth;
	const storedValue = window.localStorage.getItem(sourcePanelWidthStorageKey);
	const storedWidth = storedValue ? Number.parseFloat(storedValue) : NaN;
	return Number.isFinite(storedWidth) ? storedWidth : defaultSourcePanelWidth;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
