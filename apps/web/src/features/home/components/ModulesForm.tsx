"use client";

import { Checkbox, cn, Label } from "@seikatsu/ui";
import { useId, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setModuleOn } from "@/features/home/actions/apps";
import { APPS_CONFIG } from "@/lib/app-themes";
import { APP_HREFS, FEATURE_HREFS, FEATURES, type ModuleHref, modulesOn } from "@/lib/modules";

type Row = { href: ModuleHref; kanji: string; name: string; detail: string; needs?: ModuleHref };

const APP_ROWS: Row[] = APP_HREFS.map((href) => ({
	href,
	kanji: APPS_CONFIG[href].kanji,
	name: `${APPS_CONFIG[href].name} · ${APPS_CONFIG[href].label}`,
	detail: APPS_CONFIG[href].pitch,
}));

const FEATURE_ROWS: Row[] = FEATURE_HREFS.map((href) => {
	const f: { name: string; kanji: string; pitch: string; needs?: ModuleHref } = FEATURES[href];
	return { href, kanji: f.kanji, name: f.name, detail: f.pitch, needs: f.needs };
});

/** Which apps and features are on. Saves as you go; off hides one everywhere, its data kept. */
export function ModulesForm({ off: saved, group }: { off: string[]; group: "apps" | "features" }) {
	const id = useId();
	const [, startTransition] = useTransition();
	const [off, setOff] = useOptimistic(saved, (list, p: { href: ModuleHref; on: boolean }) =>
		p.on ? list.filter((h) => h !== p.href) : [...list, p.href],
	);
	const on = modulesOn(off);

	function toggle(href: ModuleHref, next: boolean) {
		startTransition(async () => {
			setOff({ href, on: next });
			const result = await setModuleOn(href, next).catch(() => ({
				error: "Couldn't save. Check your connection.",
			}));
			if ("error" in result) toast.error(result.error);
		});
	}

	const rows = group === "apps" ? APP_ROWS : FEATURE_ROWS;
	return (
		<ul className="inset-group">
			{rows.map((row) => {
				const blocked = row.needs !== undefined && !on.includes(row.needs);
				return (
					<li key={row.href} className={cn("flex items-start gap-3 py-3", row.needs && "pl-6")}>
						<Checkbox
							id={`${id}-${row.href}`}
							checked={on.includes(row.href)}
							disabled={blocked}
							onCheckedChange={(checked) => toggle(row.href, checked === true)}
							className="mt-0.5"
						/>
						<div className={cn("min-w-0 flex-1", blocked && "opacity-60")}>
							<Label htmlFor={`${id}-${row.href}`} className="text-sm font-normal">
								<span aria-hidden className="mr-1.5 text-muted-foreground">
									{row.kanji}
								</span>
								{row.name}
							</Label>
							<p className="mt-0.5 text-sm text-muted-foreground">
								{blocked && row.needs
									? `Needs ${FEATURES[row.needs as keyof typeof FEATURES]?.name ?? row.needs} on.`
									: row.detail}
							</p>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
