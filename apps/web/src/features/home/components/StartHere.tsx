import { APPS_CONFIG } from "@/lib/app-themes";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import type { CSSProperties } from "react";

type AppHref = keyof typeof APPS_CONFIG;

/** What each app is for, in a line, and the first thing its welcome asks for. */
const PITCH: Record<AppHref, { line: string; first: string }> = {
	"/kuroji": {
		line: "Where the money comes from and where it goes.",
		first: "Record a transaction",
	},
	"/seiryu": {
		line: "A board per project, cards moved along as work gets done.",
		first: "Make a board",
	},
	"/tsundoku": {
		line: "The books to read, the one you're in, and what you thought.",
		first: "Add a book",
	},
	"/keizoku": {
		line: "Habits kept a day at a time, forgotten days filled in.",
		first: "Pick habits",
	},
	"/kyuu": {
		line: "Every job application, from first look to the answer.",
		first: "Add an application",
	},
	"/aisha": {
		line: "The car's service plan, mileage and papers: what's due next.",
		first: "Add your car",
	},
};

interface Props {
	apps: AppHref[];
	/** Every app is still empty: this is the whole home. */
	all: boolean;
	/** Stagger after the tiles above it. */
	offset: number;
}

/** Apps not started yet, each opening on its own welcome. One goes away once it holds something. */
export function StartHere({ apps, all, offset }: Props) {
	return (
		<section aria-labelledby="start-here" className="space-y-3">
			<div className="animate-rise" style={{ "--i": offset } as CSSProperties}>
				<h2 id="start-here" className="text-sm font-medium">
					{all ? "Start with any one" : "Not started yet"}
				</h2>
				{!all && <p className="text-xs text-muted-foreground">Here when you need them.</p>}
			</div>
			<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{apps.map((href, i) => {
					const app = APPS_CONFIG[href];
					return (
						<li
							key={href}
							className={cn(app.theme, "animate-rise")}
							style={{ "--i": offset + i + 1 } as CSSProperties}
						>
							<Link
								href={href}
								prefetch
								className="group flex h-full gap-3 rounded-xl bg-surface p-4 outline-none transition-colors duration-150 hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-ring"
							>
								<span
									aria-hidden
									className="grid size-10 shrink-0 place-items-center rounded-lg bg-background text-xl font-semibold text-primary"
								>
									{app.kanji}
								</span>
								<span className="flex min-w-0 flex-col">
									<span className="text-sm font-medium">
										{app.name}
										<span className="font-normal text-muted-foreground"> · {app.label}</span>
									</span>
									<span className="mt-0.5 text-sm text-muted-foreground">{PITCH[href].line}</span>
									<span className="mt-auto pt-3 text-sm font-medium text-primary">
										{PITCH[href].first}
										<span
											aria-hidden
											className="ml-1 inline-block transition-transform duration-150 ease-out group-hover:translate-x-0.5"
										>
											→
										</span>
									</span>
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
