"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Checkbox, cn, Input, Label } from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { Spinner } from "@/components/Spinner";
import { Steps, StepTitle } from "@/features/day/components/Steps";
import { CURRENCIES, type Currency } from "@/features/kuroji/lib/constants";
import { completeWelcome } from "@/features/welcome/actions/welcome";
import { detailsFor, offFor } from "@/features/welcome/lib/welcome";
import { APPS_CONFIG } from "@/lib/app-themes";
import { pageKey } from "@/lib/capture-shortcut";
import {
	APP_HREFS,
	type AppHref,
	FEATURE_HREFS,
	FEATURES,
	type FeatureHref,
	modulesOn,
} from "@/lib/modules";

type Step = "apps" | "rhythm" | "details";

const toggled = <T,>(list: T[], item: T) =>
	list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

/**
 * The first run: the apps to keep, how to plan across them, then the few details those apps
 * need (the main currency, a first board). The rest is switched off and stays out of the way;
 * Settings → Apps brings any of it back.
 */
export function WelcomeFlow({
	firstName,
	again,
	start,
	currency: savedCurrency,
	canSetCurrency,
	noBoards,
}: {
	firstName: string | null;
	/** Setting up again from Settings: the current choice, and back to Settings after. */
	again: boolean;
	start: { apps: AppHref[]; features: FeatureHref[] };
	currency: string;
	canSetCurrency: boolean;
	noBoards: boolean;
}) {
	const router = useRouter();
	const id = useId();
	const [step, setStep] = useState<Step>("apps");
	const [apps, setApps] = useState<AppHref[]>(start.apps);
	const [features, setFeatures] = useState<FeatureHref[]>(start.features);
	const [currency, setCurrency] = useState<Currency>(
		(CURRENCIES as readonly string[]).includes(savedCurrency) ? (savedCurrency as Currency) : "EUR",
	);
	const [board, setBoard] = useState("");
	const [saving, startSaving] = useTransition();

	const details = detailsFor(apps, canSetCurrency, noBoards);
	const hasDetails = details.currency || details.board;
	const steps: Step[] = hasDetails ? ["apps", "rhythm", "details"] : ["apps", "rhythm"];
	const index = steps.indexOf(step);
	const last = index === steps.length - 1;
	// What the chosen features still lack: Week plan without Week.
	const on = modulesOn(offFor(apps, features));

	function next() {
		if (step === "apps" && apps.length === 0) {
			toast.error("Pick at least one app");
			return;
		}
		if (last) finish();
		else setStep(steps[index + 1] ?? step);
	}

	function back() {
		if (index > 0) setStep(steps[index - 1] ?? step);
	}

	function finish() {
		startSaving(async () => {
			const result = await completeWelcome({
				apps,
				features: features.filter((f) => on.includes(f)),
				currency: details.currency ? currency : null,
				board: details.board && board.trim() ? board.trim() : null,
			}).catch(() => ({ error: "Couldn't save. Check your connection." }));
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			startNavigationProgress();
			router.push(again ? "/settings/apps" : "/");
		});
	}

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (!k || saving) return;
			if (k === "]") {
				e.preventDefault();
				next();
			} else if (k === "[") {
				e.preventDefault();
				back();
			} else if (/^[1-9]$/.test(k)) {
				const n = Number(k) - 1;
				if (step === "apps" && APP_HREFS[n]) {
					e.preventDefault();
					setApps((prev) => toggled(prev, APP_HREFS[n] as AppHref));
				} else if (step === "rhythm" && FEATURE_HREFS[n]) {
					e.preventDefault();
					setFeatures((prev) => toggled(prev, FEATURE_HREFS[n] as FeatureHref));
				}
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

	return (
		<div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-28 sm:px-8 md:pt-14">
			<p aria-hidden className="mb-6 animate-rise text-3xl font-bold leading-none">
				生活
			</p>
			<Steps step={index} of={steps.length} />

			{step === "apps" && (
				<>
					<StepTitle
						title={
							again ? "Your apps" : firstName ? `Welcome, ${firstName}` : "Welcome to seikatsu"
						}
						subtitle="Pick the apps you'll use. The rest stay out of the way, and can come back any time in Settings."
					/>
					<ul aria-label="Apps" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
						{APP_HREFS.map((href, i) => {
							const app = APPS_CONFIG[href];
							const picked = apps.includes(href);
							return (
								<li
									key={href}
									className={cn(app.theme, "animate-rise")}
									style={{ "--i": i } as CSSProperties}
								>
									<button
										type="button"
										aria-pressed={picked}
										aria-keyshortcuts={String(i + 1)}
										onClick={() => setApps((prev) => toggled(prev, href))}
										className={cn(
											"group relative isolate flex h-full w-full items-start gap-3 overflow-hidden rounded-group bg-surface p-4 text-left outline-none transition-[background-color,box-shadow] duration-150 ease-out hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring",
											picked && "ring-2 ring-primary",
										)}
									>
										<span
											aria-hidden
											className="grid size-10 shrink-0 place-items-center rounded-button bg-primary/10 text-lg font-semibold text-primary"
										>
											{app.kanji}
										</span>
										<span className="min-w-0 flex-1">
											<span className="block text-sm font-medium">
												{app.label}
												<span className="text-muted-foreground"> · {app.name}</span>
											</span>
											<span className="mt-0.5 block text-sm text-muted-foreground">
												{app.pitch}
											</span>
										</span>
										<span
											aria-hidden
											className={cn(
												"grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150",
												picked
													? "border-primary bg-primary text-primary-foreground"
													: "border-border",
											)}
										>
											{picked && <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				</>
			)}

			{step === "rhythm" && (
				<>
					<StepTitle
						title="How do you plan?"
						subtitle="Today always lists what's due across your apps, and Capture (⌘K) puts one line into any of them. These add a rhythm on top; skip them for a quieter start."
					/>
					<ul aria-label="Rhythm" className="inset-group">
						{FEATURE_HREFS.map((href) => {
							const feature: { name: string; kanji: string; pitch: string; needs?: string } =
								FEATURES[href];
							const blocked =
								feature.needs !== undefined && !features.includes(feature.needs as FeatureHref);
							return (
								<li
									key={href}
									className={cn("flex items-start gap-3 py-3", feature.needs && "pl-6")}
								>
									<Checkbox
										id={`${id}-${href}`}
										checked={features.includes(href) && !blocked}
										disabled={blocked}
										onCheckedChange={() => setFeatures((prev) => toggled(prev, href))}
										className="mt-0.5"
									/>
									<div className={cn("min-w-0 flex-1", blocked && "opacity-60")}>
										<Label htmlFor={`${id}-${href}`} className="text-sm font-normal">
											<span aria-hidden className="mr-1.5 text-muted-foreground">
												{feature.kanji}
											</span>
											{feature.name}
										</Label>
										<p className="mt-0.5 text-sm text-muted-foreground">{feature.pitch}</p>
									</div>
								</li>
							);
						})}
					</ul>
				</>
			)}

			{step === "details" && (
				<>
					<StepTitle
						title="A couple of details"
						subtitle="Every other app asks for its first thing when you open it."
					/>
					<div className="space-y-6">
						{details.currency && (
							<section className="theme-kuroji space-y-2">
								<h2 className="text-sm font-medium">
									<span aria-hidden className="mr-1.5 text-primary">
										黒
									</span>
									Your main currency
								</h2>
								<p className="text-sm text-muted-foreground">
									Totals and budgets are in it; money in other currencies is converted.
								</p>
								<div role="radiogroup" aria-label="Main currency" className="flex flex-wrap gap-2">
									{CURRENCIES.map((c) => (
										<button
											key={c}
											type="button"
											role="radio"
											aria-checked={currency === c}
											onClick={() => setCurrency(c)}
											className={cn(
												"h-9 min-w-16 rounded-button px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
												currency === c
													? "bg-primary text-primary-foreground"
													: "bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground",
											)}
										>
											{c}
										</button>
									))}
								</div>
							</section>
						)}
						{details.board && (
							<section className="theme-seiryu space-y-2">
								<Label htmlFor={`${id}-board`} className="text-sm font-medium">
									<span aria-hidden className="mr-1.5 text-primary">
										清
									</span>
									A first board
								</Label>
								<p className="text-sm text-muted-foreground">
									One per project, with To do · Doing · Done. Leave it empty to start later.
								</p>
								<Input
									id={`${id}-board`}
									value={board}
									onChange={(e) => setBoard(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											next();
										}
									}}
									placeholder="Home"
									maxLength={60}
									className="max-w-sm"
								/>
							</section>
						)}
					</div>
				</>
			)}

			<div className="mt-8 flex items-center gap-2">
				{index > 0 && (
					<Button variant="ghost" onClick={back} disabled={saving} aria-keyshortcuts="[">
						Back
					</Button>
				)}
				<Button
					onClick={next}
					disabled={saving || (step === "apps" && apps.length === 0)}
					aria-keyshortcuts="]"
					className="gap-1.5"
				>
					{saving && <Spinner />}
					{saving ? "Saving…" : last ? (again ? "Save" : "Start") : "Next"}
				</Button>
				{step === "apps" && (
					<span className="ml-2 text-xs text-muted-foreground">
						{apps.length === 0 ? "Press 1–7 to pick" : `${apps.length} picked`}
					</span>
				)}
			</div>
		</div>
	);
}
