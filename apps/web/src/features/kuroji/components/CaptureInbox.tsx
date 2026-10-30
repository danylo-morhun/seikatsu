"use client";

import { type PendingCapture, dismissCapture } from "@/features/kuroji/actions/capture";
import { AddTransactionModal } from "@/features/kuroji/components/AddTransactionModal";
import { toCurrency } from "@/features/kuroji/lib/constants";
import { parseLocal } from "@/features/kuroji/lib/dates";
import { formatCurrency } from "@/features/kuroji/lib/format";
import type { AddTransactionFormValues } from "@/features/kuroji/lib/transaction-schema";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { format } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function formValues(c: PendingCapture): AddTransactionFormValues {
	return {
		txType: "expense",
		description: c.merchant,
		currency: toCurrency(c.currency),
		date: c.day,
		walletId: c.walletId ?? "",
		splits: [{ categoryId: c.categoryId ?? "", amount: c.amount }],
	};
}

/**
 * Apple Pay payments the iPhone Shortcut sent, waiting to be added. A push opens
 * `/kuroji?capture=<id>`, which opens that payment's dialog straight away.
 */
export function CaptureInbox({
	workspaceId,
	baseCurrency,
	captures,
}: {
	workspaceId: string;
	baseCurrency: string;
	captures: PendingCapture[];
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	// Stays set while the dialog closes, so it can animate out; `opened` remounts the form.
	const [active, setActive] = useState<PendingCapture | null>(null);
	const [open, setOpen] = useState(false);
	const [opened, setOpened] = useState(0);
	function add(c: PendingCapture) {
		setActive(c);
		setOpened((n) => n + 1);
		setOpen(true);
	}
	const [hidden, setHidden] = useState<Set<string>>(new Set());

	const linked = searchParams.get("capture");
	const handled = useRef<string | null>(null);
	useEffect(() => {
		if (!linked || handled.current === linked) return;
		handled.current = linked;
		const hit = captures.find((c) => c.id === linked);
		if (hit) add(hit);
		else toast("This payment is already in Kuroji.");
		const rest = new URLSearchParams(searchParams.toString());
		rest.delete("capture");
		router.replace(rest.size > 0 ? `${pathname}?${rest}` : pathname, { scroll: false });
	}, [linked, captures, searchParams, pathname, router]);

	async function dismiss(id: string) {
		setHidden((h) => new Set(h).add(id));
		const result = await dismissCapture(id).catch(() => ({ error: "Couldn't dismiss it." }));
		if ("error" in result) {
			toast.error(result.error);
			setHidden((h) => {
				const next = new Set(h);
				next.delete(id);
				return next;
			});
		}
	}

	// Stable while open: the dialog converts the amount whenever this or its wallet changes.
	const prefill = useMemo(
		() =>
			active && {
				captureId: active.id,
				values: formValues(active),
				paid: { amount: active.amount, currency: active.currency, merchant: active.merchant },
				rates: active.rates,
			},
		[active],
	);

	const shown = captures.filter((c) => !hidden.has(c.id));

	return (
		<>
			{shown.length > 0 && (
				<section aria-labelledby="capture-inbox-title" className="animate-rise px-4 pt-6 sm:px-8">
					<h2 id="capture-inbox-title" className="mb-2 text-xs text-muted-foreground">
						Apple Pay · {shown.length} to add
					</h2>
					<ul className="inset-group rounded-2xl bg-surface px-4 divide-y divide-rule">
						{shown.map((c) => (
							<li key={c.id} className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => add(c)}
									className="flex min-w-0 flex-1 items-baseline gap-3 py-2.5 text-left transition-colors hover:text-primary"
								>
									<span className="truncate text-sm">{c.merchant}</span>
									<span className="shrink-0 text-xs text-muted-foreground">
										{format(parseLocal(c.day), "d MMM")}, {c.time}
									</span>
									<span className="ml-auto shrink-0 font-figures text-sm tabular-nums">
										{formatCurrency(c.amount, c.currency)}
									</span>
								</button>
								<Button
									variant="ghost"
									size="icon"
									className="shrink-0 text-muted-foreground hover:text-foreground"
									aria-label={`Dismiss ${c.merchant}`}
									onClick={() => dismiss(c.id)}
								>
									<HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
								</Button>
							</li>
						))}
					</ul>
				</section>
			)}
			{prefill && (
				<AddTransactionModal
					key={opened}
					workspaceId={workspaceId}
					baseCurrency={baseCurrency}
					prefill={prefill}
					open={open}
					onOpenChange={setOpen}
				/>
			)}
		</>
	);
}
