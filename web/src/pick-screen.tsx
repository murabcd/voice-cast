import { Check, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { characters } from "./app-data";
import type { Character } from "./app-types";
import { cn } from "./lib/utils";

interface PickScreenProps {
	canScrollLeft: boolean;
	canScrollRight: boolean;
	onDone: () => void;
	onScroll: () => void;
	onScrollBy: (direction: "left" | "right") => void;
	onSelect: (id: number) => void;
	scrollRef: React.RefObject<HTMLDivElement | null>;
	selectedId: number;
}

export function PickScreen({
	canScrollLeft,
	canScrollRight,
	onDone,
	onScroll,
	onScrollBy,
	onSelect,
	scrollRef,
	selectedId,
}: PickScreenProps) {
	return (
		<section className="flex min-h-screen flex-col items-center justify-center px-6 pt-[90px] pb-[58px] max-[760px]:min-h-svh max-[760px]:justify-start max-[760px]:px-0 max-[760px]:pt-[86px] max-[760px]:pb-[52px] max-[760px]:text-center">
			<div className="mb-12 text-center max-[760px]:mb-[26px] max-[760px]:w-[min(100%-36px,520px)]">
				<h1 className="text-[28px] leading-[1.12] font-[520] tracking-normal max-[760px]:text-[29px]">
					Choose a character
				</h1>
				<p className="mt-2 mb-0 text-[17px]">or keep the current personality</p>
			</div>
			<div className="relative w-[min(1060px,100%)] max-[760px]:w-full">
				{canScrollLeft && (
					<Button
						variant="ghost"
						className="absolute top-[52px] left-1 z-[3] size-12 rounded-full bg-white/90 p-0 text-black shadow-[0_8px_22px_rgba(0,0,0,0.14),inset_0_0_0_1px_rgba(0,0,0,0.08)] backdrop-blur-sm max-[760px]:top-[91px] max-[760px]:left-2.5 max-[760px]:size-11 [&_svg]:size-[22px] [&_svg]:stroke-[2.6]"
						onClick={() => onScrollBy("left")}
						aria-label="Scroll left"
					>
						<ChevronLeft />
					</Button>
				)}
				{canScrollLeft && (
					<div className="pointer-events-none absolute inset-y-0 left-0 z-2 w-[70px] bg-linear-to-r from-white to-white/0 max-[760px]:w-[54px]" />
				)}
				{canScrollRight && (
					<div className="pointer-events-none absolute inset-y-0 right-0 z-2 w-[70px] bg-linear-to-l from-white to-white/0 max-[760px]:w-[54px]" />
				)}
				<div
					ref={scrollRef}
					className="flex gap-[18px] overflow-x-auto px-[42px] pt-1 pb-3 [scrollbar-width:none] max-[760px]:px-14 [&::-webkit-scrollbar]:hidden"
					onScroll={onScroll}
				>
					{characters.map((character) => {
						const isSelected = selectedId === character.id;
						return (
							<CharacterOption
								character={character}
								isSelected={isSelected}
								key={character.id}
								onSelect={onSelect}
							/>
						);
					})}
				</div>
				{canScrollRight && (
					<Button
						variant="ghost"
						className="absolute top-[52px] right-1 z-[3] size-12 rounded-full bg-white/90 p-0 text-black shadow-[0_8px_22px_rgba(0,0,0,0.14),inset_0_0_0_1px_rgba(0,0,0,0.08)] backdrop-blur-sm max-[760px]:top-[91px] max-[760px]:right-2.5 max-[760px]:size-11 [&_svg]:size-[22px] [&_svg]:stroke-[2.6]"
						onClick={() => onScrollBy("right")}
						aria-label="Scroll right"
					>
						<ChevronRight />
					</Button>
				)}
			</div>
			<Button
				className="mt-[42px] h-12 w-[min(332px,calc(100vw-48px))] gap-[9px] rounded-xl bg-[#050505] px-[22px] font-[650] text-white shadow-[0_10px_24px_rgba(0,0,0,0.1)] transition-[transform,background,opacity,box-shadow] duration-140 ease-out active:scale-[0.985] hover:bg-[#202020] max-[760px]:mx-auto [&_svg]:size-[17px]"
				onClick={onDone}
			>
				Save character
			</Button>
		</section>
	);
}

function CharacterOption({
	character,
	isSelected,
	onSelect,
}: {
	character: Character;
	isSelected: boolean;
	onSelect: (id: number) => void;
}) {
	const [loaded, setLoaded] = useState(false);

	return (
		<Button
			type="button"
			variant="ghost"
			className="group flex h-auto flex-none flex-col items-center gap-[13px] border-0 bg-transparent p-0 text-base text-[#050505]"
			onClick={() => onSelect(character.id)}
		>
			<span
				className={cn(
					"relative block h-[135px] w-60 overflow-hidden rounded-2xl bg-[#f2f2f2] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition-[box-shadow,transform] duration-160 ease-out group-hover:translate-y-[-1px] group-hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.18),0_10px_22px_rgba(0,0,0,0.08)] max-[760px]:h-[222px] max-[760px]:w-[150px] [&_img]:size-full [&_img]:object-cover [&_img]:object-top",
					isSelected &&
						"shadow-[0_0_0_3px_#050505,0_14px_28px_rgba(0,0,0,0.16)]",
				)}
			>
				{!loaded && (
					<Skeleton
						className="absolute inset-0 z-0 flex items-center justify-center rounded-[inherit] bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.58),rgba(255,255,255,0)),#ececec] bg-[length:220%_100%]"
						aria-hidden="true"
					>
						<LoaderCircle className="size-6 animate-spin text-black/40" />
					</Skeleton>
				)}
				<img
					src={character.image}
					alt={character.name}
					className={cn(
						"relative z-1 opacity-0 transition-opacity duration-180 ease-out",
						loaded && "opacity-100",
					)}
					onLoad={() => setLoaded(true)}
				/>
				{isSelected && (
					<span className="absolute top-[9px] right-[9px] flex size-[27px] items-center justify-center rounded-full bg-[#050505] text-white [&_svg]:size-4">
						<Check />
					</span>
				)}
			</span>
			<span>{character.name}</span>
		</Button>
	);
}
