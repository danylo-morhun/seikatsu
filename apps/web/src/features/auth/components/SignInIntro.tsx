import { APPS_CONFIG } from "@/lib/app-themes";
import { cn } from "@seikatsu/ui";
import type { CSSProperties } from "react";

/** Beside the sign-in: what seikatsu is, and the apps inside, for someone who has never seen it. */
export function SignInIntro() {
	return (
		<section aria-labelledby="intro-title" className="w-full max-w-md">
			<p aria-hidden className="animate-rise text-4xl font-bold leading-none">
				生活
			</p>
			<h2
				id="intro-title"
				className="mt-4 animate-rise text-2xl font-semibold tracking-tight md:text-3xl"
				style={{ "--i": 1 } as CSSProperties}
			>
				Everyday life, kept in one place.
			</h2>
			<p className="mt-3 animate-rise text-muted-foreground" style={{ "--i": 2 } as CSSProperties}>
				seikatsu is six small apps under one sign-in. Use the ones you need; the rest stay out of
				the way.
			</p>
			<ul className="mt-8 space-y-4 max-lg:hidden">
				{Object.entries(APPS_CONFIG).map(([href, app], i) => (
					<li
						key={href}
						className={cn(app.theme, "flex animate-rise gap-3")}
						style={{ "--i": i + 3 } as CSSProperties}
					>
						<span
							aria-hidden
							className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 font-semibold text-primary"
						>
							{app.kanji}
						</span>
						<span className="text-sm">
							<span className="font-medium">{app.label}</span>
							<span className="block text-muted-foreground">{app.pitch}</span>
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}
