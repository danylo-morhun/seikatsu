"use client";

import { setAppHidden } from "@/features/home/actions/apps";
import { APPS_CONFIG } from "@/lib/app-themes";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@seikatsu/ui";
import Link from "next/link";
import { type CSSProperties, useOptimistic, useTransition } from "react";
import { toast } from "sonner";

type AppHref = keyof typeof APPS_CONFIG;

interface Props {
	apps: AppHref[];
	/** Apps set aside; listed at the foot so they can come back. */
	hidden: AppHref[];
	/** Every app is still empty: this is the whole home. */
	all: boolean;
	/** Stagger after the tiles above it. */
	offset: number;
}

/** Apps not started yet, each opening on its own welcome. One goes away once it holds
 * something, or when it is set aside. */
export function StartHere({ apps, hidden: saved, all, offset }: Props) {
	const [, startTransition] = useTransition();
	const [hidden, setHidden] = useOptimistic(saved, (list, p: { app: AppHref; hide: boolean }) =>
		p.hide ? [...list, p.app] : list.filter((h) => h !== p.app),
	);
	const shown = apps.filter((href) => !hidden.includes(href));

	function toggle(app: AppHref, hide: boolean) {
		startTransition(async () => {
			setHidden({ app, hide });
			const result = await setAppHidden(app, hide).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) toast.error(result.error);
		});
	}

	return (
		<section
			aria-labelledby={shown.length > 0 ? "start-here" : undefined}
			aria-label={shown.length > 0 ? undefined : "Hidden apps"}
			className="space-y-3"
		>
			{shown.length > 0 && (
				<>
					<div className="animate-rise" style={{ "--i": offset } as CSSProperties}>
						<h2 id="start-here" className="text-sm font-medium">
							{all ? "Start with any one" : "Not started yet"}
						</h2>
						<p className="text-xs text-muted-foreground">
							{all
								? "Hide the ones you won't use; they can come back any time."
								: "Here when you need them."}
						</p>
					</div>
					<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{shown.map((href, i) => {
							const app = APPS_CONFIG[href];
							return (
								<li
									key={href}
									className={cn(app.theme, "relative animate-rise")}
									style={{ "--i": offset + i + 1 } as CSSProperties}
								>
									<Link
										href={href}
										prefetch
										className="group flex h-full gap-3 rounded-xl bg-surface p-4 pr-10 outline-none transition-colors duration-150 hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-ring"
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
											<span className="mt-0.5 text-sm text-muted-foreground">{app.pitch}</span>
											<span className="mt-auto pt-3 text-sm font-medium text-primary">
												{app.first}
												<span
													aria-hidden
													className="ml-1 inline-block transition-transform duration-150 ease-out group-hover:translate-x-0.5"
												>
													→
												</span>
											</span>
										</span>
									</Link>
									<button
										type="button"
										onClick={() => toggle(href, true)}
										aria-label={`Hide ${app.name}`}
										title="Hide"
										className="absolute top-2 right-2 grid size-8 place-items-center rounded-md text-muted-foreground/60 transition-colors duration-150 hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
									>
										<HugeiconsIcon icon={Cancel01Icon} size={14} />
									</button>
								</li>
							);
						})}
					</ul>
				</>
			)}
			{hidden.length > 0 && (
				<p className="text-xs text-muted-foreground">
					Hidden:{" "}
					{hidden.map((href, i) => (
						<span key={href}>
							{i > 0 && " · "}
							<button
								type="button"
								onClick={() => toggle(href, false)}
								className="underline-offset-2 transition-colors hover:text-foreground hover:underline"
								aria-label={`Show ${APPS_CONFIG[href].name} again`}
							>
								{APPS_CONFIG[href].name}
							</button>
						</span>
					))}
				</p>
			)}
		</section>
	);
}
