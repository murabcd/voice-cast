import { Check, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { characters } from "./app-data";
import type { Character } from "./app-types";

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
		<section className="pick-screen">
			<div className="pick-title">
				<h1>Choose a character</h1>
				<p>or keep the current voice personality</p>
			</div>
			<div className="carousel-wrap">
				{canScrollLeft && (
					<Button
						variant="ghost"
						className="button button-ghost carousel-arrow left"
						onClick={() => onScrollBy("left")}
						aria-label="Scroll left"
					>
						<ChevronLeft />
					</Button>
				)}
				{canScrollLeft && <div className="carousel-fade left" />}
				{canScrollRight && <div className="carousel-fade right" />}
				<div ref={scrollRef} className="character-carousel" onScroll={onScroll}>
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
						className="button button-ghost carousel-arrow right"
						onClick={() => onScrollBy("right")}
						aria-label="Scroll right"
					>
						<ChevronRight />
					</Button>
				)}
			</div>
			<Button className="button button-primary next-button" onClick={onDone}>
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
			className="character-option"
			onClick={() => onSelect(character.id)}
		>
			<span className={`character-card ${isSelected ? "selected" : ""}`}>
				{!loaded && (
					<Skeleton className="character-card-skeleton" aria-hidden="true">
						<LoaderCircle className="character-card-loader" />
					</Skeleton>
				)}
				<img
					src={character.image}
					alt={character.name}
					className={loaded ? "is-loaded" : ""}
					onLoad={() => setLoaded(true)}
				/>
				{isSelected && (
					<span className="selected-check">
						<Check />
					</span>
				)}
			</span>
			<span>{character.name}</span>
		</Button>
	);
}
