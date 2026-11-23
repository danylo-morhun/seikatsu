import { cn } from "@seikatsu/ui";
import Link from "next/link";
import type { CSSProperties } from "react";
import { SignInCard } from "@/features/auth/components/SignInCard";
import { APPS_CONFIG } from "@/lib/app-themes";
import { APP_HREFS, type AppHref } from "@/lib/modules";

/** What each app does best, in a line, for someone deciding whether to try it. */
const STRENGTH: Record<AppHref, string> = {
	"/kuroji": "Real double-entry in any currency. A card payment logged in one tap.",
	"/seiryu": "Boards, groups and checklists; due times that remind you.",
	"/tsundoku": "Find a book, log pages, keep the lines worth keeping.",
	"/keizoku": "The week at a glance; a forgotten day filled in later.",
	"/kyuu": "Every application with its timeline of replies and calls.",
	"/aisha": "Service, mileage and papers, told before they're due.",
	"/hoshii": "Wants cool off first; the keepers are saved for in order.",
};

const PRINCIPLES = [
	{
		title: "Seconds to log",
		body: "One line, typed anywhere, lands in the right app: “coffee 14 zł, call the garage tomorrow”. On the phone, from the share sheet, or after an Apple Pay payment.",
	},
	{
		title: "Only what you use",
		body: "Pick the apps you need when you start. The rest stay switched off: not in the menus, not on Today, not in your notifications.",
	},
	{
		title: "Yours, on every device",
		body: "Installs like an app on phone and desktop, works offline and catches up later. Connect Claude to ask about your own numbers.",
	},
];

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

/** The signed-out home: what seikatsu is, the apps inside, and the way in. */
export function Landing() {
	return (
		<div className="min-h-screen">
			<header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-8">
				<span className="flex items-baseline gap-2">
					<span aria-hidden className="text-xl font-bold">
						生
					</span>
					<span className="text-sm font-semibold">seikatsu</span>
				</span>
				<a
					href="#start"
					className="rounded-button px-3 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
				>
					Sign in
				</a>
			</header>

			<main>
				<section
					aria-labelledby="hero-title"
					className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-8 md:pt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:pb-28"
				>
					<div>
						<p aria-hidden className="animate-rise text-5xl font-bold leading-none md:text-6xl">
							生活
						</p>
						<h1
							id="hero-title"
							className="mt-6 max-w-xl animate-rise text-3xl font-semibold tracking-tight text-balance md:text-5xl"
							style={rise(1)}
						>
							Everyday life, in small exact tools.
						</h1>
						<p
							className="mt-5 max-w-lg animate-rise text-base text-muted-foreground md:text-lg"
							style={rise(2)}
						>
							Money, projects, books, habits, the job search, the car and the things you want: seven
							focused apps under one sign-in. Keep the ones you'll use.
						</p>
						<div className="mt-8 flex animate-rise flex-wrap items-center gap-3" style={rise(3)}>
							<a
								href="#start"
								className="inline-flex h-10 items-center rounded-button bg-primary px-5 text-sm font-medium text-primary-foreground outline-none transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
							>
								Get started
							</a>
							<a
								href="#apps"
								className="inline-flex h-10 items-center rounded-button px-4 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
							>
								See the apps
							</a>
						</div>
					</div>
					<CaptureDemo />
				</section>

				<section
					id="apps"
					aria-labelledby="apps-title"
					className="mx-auto w-full max-w-6xl scroll-mt-8 px-4 pb-20 sm:px-8 lg:pb-28"
				>
					<h2 id="apps-title" className="text-sm font-medium">
						The apps
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Each one narrow and precise. Together they share one account, one look and one list of
						what's due today.
					</p>
					<ul className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3">
						{APP_HREFS.map((href) => {
							const app = APPS_CONFIG[href];
							return (
								<li
									key={href}
									className={cn(
										app.theme,
										"relative isolate min-h-40 overflow-hidden rounded-group bg-surface p-5",
									)}
								>
									<span
										aria-hidden
										className="pointer-events-none absolute -right-3 -bottom-8 -z-10 select-none text-[8.5rem] leading-none font-bold text-primary/10"
									>
										{app.kanji}
									</span>
									<h3 className="flex items-baseline gap-2 text-sm font-medium">
										<span aria-hidden className="text-primary">
											{app.kanji}
										</span>
										{app.label}
										<span className="text-muted-foreground">· {app.name}</span>
									</h3>
									<p className="mt-3 max-w-xs text-sm">{app.pitch}</p>
									<p className="mt-1 max-w-xs text-sm text-muted-foreground">{STRENGTH[href]}</p>
								</li>
							);
						})}
					</ul>
				</section>

				<section
					aria-label="Why seikatsu"
					className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-20 sm:px-8 md:grid-cols-3 lg:pb-28"
				>
					{PRINCIPLES.map((p) => (
						<div key={p.title} className="border-t border-rule pt-5">
							<h2 className="text-sm font-medium">{p.title}</h2>
							<p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
						</div>
					))}
				</section>

				<section
					id="start"
					aria-label="Sign in"
					className="mx-auto flex w-full max-w-6xl scroll-mt-8 flex-col items-center px-4 pb-24 sm:px-8"
				>
					<p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
						Sign in, pick your apps, and the first one is ready in a minute.
					</p>
					<SignInCard />
				</section>
			</main>

			<footer className="mx-auto flex w-full max-w-6xl items-center justify-between border-t border-rule px-4 py-6 text-xs text-muted-foreground sm:px-8">
				<span>生活 seikatsu</span>
				<nav aria-label="Legal" className="flex gap-4">
					<Link href="/privacy" className="hover:text-foreground">
						Privacy
					</Link>
					<Link href="/terms" className="hover:text-foreground">
						Terms
					</Link>
				</nav>
			</footer>
		</div>
	);
}

/** One line in, rows out: what Capture does, drawn with the apps' own parts. Illustration. */
function CaptureDemo() {
	return (
		<figure className="min-w-0 animate-rise" style={rise(2)}>
			<div
				aria-hidden
				className="rounded-overlay border border-rule bg-card p-3 shadow-[0_24px_48px_-16px_oklch(0_0_0/55%)] sm:p-4"
			>
				<div className="flex items-center gap-2.5 rounded-field border border-input px-3 py-2.5 text-sm">
					<span className="text-muted-foreground">✎</span>
					<span className="min-w-0 truncate">
						coffee 14 zł with Pekao, call the garage tomorrow at 10
					</span>
					<span className="ml-auto h-4 w-px shrink-0 animate-pulse bg-foreground/70" />
				</div>

				<p className="mt-4 mb-1.5 px-1 text-xs text-muted-foreground">Two things, ready to save</p>
				<ul className="divide-y divide-rule">
					<li
						className="theme-kuroji flex animate-rise items-center gap-3 px-1 py-3"
						style={rise(4)}
					>
						<Seal kanji="黒" />
						<span className="min-w-0 flex-1">
							<span className="block text-sm font-medium">Coffee</span>
							<span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
								Pekao
								<span className="relative h-px w-6 bg-gradient-to-r from-flow/25 to-flow">
									<span className="absolute -top-[2px] -right-px size-[5px] rotate-45 border-t border-r border-flow" />
								</span>
								Dining
							</span>
						</span>
						<span className="font-figures text-sm font-medium tabular-nums">−14.00 zł</span>
					</li>
					<li
						className="theme-seiryu flex animate-rise items-center gap-3 px-1 py-3"
						style={rise(5)}
					>
						<Seal kanji="清" />
						<span className="min-w-0 flex-1">
							<span className="block text-sm font-medium">Call the garage</span>
							<span className="mt-0.5 block text-xs text-muted-foreground">
								Car · a card in Seiryu
							</span>
						</span>
						<span className="text-xs text-muted-foreground tabular-nums">Tomorrow 10:00</span>
					</li>
				</ul>

				<p className="mt-4 mb-1.5 px-1 text-xs text-muted-foreground">Today</p>
				<ul className="divide-y divide-rule">
					<DemoRow kanji="継" theme="theme-keizoku" title="Gym" note="Habit · Wed, Fri left" />
					<DemoRow kanji="愛" theme="theme-aisha" title="Oil change" note="In 600 km" />
					<DemoRow
						kanji="欲"
						theme="theme-hoshii"
						title="Kindle Paperwhite"
						note="Cooled off · keep it?"
					/>
				</ul>
			</div>
			<figcaption className="sr-only">
				Capture turns one typed line into an expense in Kuroji and a card in Seiryu; Today lists
				what's due across the apps.
			</figcaption>
		</figure>
	);
}

function Seal({ kanji }: { kanji: string }) {
	return (
		<span className="grid size-8 shrink-0 place-items-center rounded-button bg-primary/10 text-sm font-semibold text-primary">
			{kanji}
		</span>
	);
}

function DemoRow({
	kanji,
	theme,
	title,
	note,
}: {
	kanji: string;
	theme: string;
	title: string;
	note: string;
}) {
	return (
		<li className={cn(theme, "flex items-center gap-3 px-1 py-2.5")}>
			<Seal kanji={kanji} />
			<span className="min-w-0 flex-1 truncate text-sm">{title}</span>
			<span className="truncate text-xs text-muted-foreground">{note}</span>
		</li>
	);
}
