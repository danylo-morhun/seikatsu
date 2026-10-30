import { APPS_CONFIG } from "@/lib/app-themes";
import { Button } from "@seikatsu/ui";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

export interface WelcomeStep {
	title: string;
	body: string;
	href?: string;
	cta?: string;
}

interface Props {
	app: keyof typeof APPS_CONFIG;
	title: string;
	lead: ReactNode;
	/** The first thing to do, right on the page: a button, or a small inline form. */
	children: ReactNode;
	steps?: WelcomeStep[];
}

/** An app's first run: its seal and name, what it is for, the first action, then how it goes on. */
export function AppWelcome({ app, title, lead, children, steps = [] }: Props) {
	const { name, label, kanji } = APPS_CONFIG[app];
	const id = `${name.toLowerCase()}-welcome`;
	return (
		<section aria-labelledby={id} className="max-w-2xl py-4 md:py-6">
			<p className="flex animate-rise items-center gap-3 text-sm text-muted-foreground">
				<span
					aria-hidden
					className="grid size-11 place-items-center rounded-xl bg-surface text-2xl font-semibold text-primary"
				>
					{kanji}
				</span>
				<span>
					<span className="block font-medium text-foreground">{name}</span>
					{label}
				</span>
			</p>
			<h1 id={id} className="mt-6 animate-rise text-2xl font-semibold md:text-3xl" style={rise(1)}>
				{title}
			</h1>
			<p className="mt-3 max-w-prose animate-rise text-muted-foreground" style={rise(2)}>
				{lead}
			</p>
			<div className="mt-6 animate-rise" style={rise(3)}>
				{children}
			</div>

			{steps.length > 0 && (
				<ol
					className="mt-12 animate-rise inset-group rounded-2xl bg-surface px-4 py-2 divide-y divide-rule [&>*:hover]:border-transparent [&>*:has(+*:hover)]:border-transparent"
					style={rise(4)}
				>
					{steps.map((step, i) => (
						<li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-x-3 py-4">
							<span className="font-figures text-sm text-muted-foreground">{i + 1}</span>
							<span>
								<span className="block text-sm font-medium">{step.title}</span>
								<span className="mt-0.5 block text-sm text-muted-foreground">{step.body}</span>
							</span>
							{step.href && (
								<Button asChild variant="ghost" size="sm" className="self-center">
									<Link href={step.href} prefetch>
										{step.cta}
									</Link>
								</Button>
							)}
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
