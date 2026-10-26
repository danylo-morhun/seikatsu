"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Spinner } from "@/components/Spinner";
import {
	type CaptureKeyStatus,
	createCaptureKey,
	deleteCaptureKey,
} from "@/features/kuroji/actions/capture";
import { Button } from "@seikatsu/ui";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

const FAILED = { error: "Couldn't save. Check your connection." } as const;

function ago(iso: string): string {
	const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 48) return `${hours} h ago`;
	return `${Math.round(hours / 24)} days ago`;
}

function CopyRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
			<code className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-1.5 font-mono text-xs">
				{value}
			</code>
			<Button
				size="sm"
				variant="outline"
				onClick={() =>
					navigator.clipboard
						.writeText(value)
						.then(() => toast.success(`${label} copied`))
						.catch(() => toast.error("Couldn't copy"))
				}
			>
				Copy
			</Button>
		</div>
	);
}

/**
 * Settings: Apple Pay. A key for an iPhone Shortcut that sends each Wallet payment here;
 * a push then opens the transaction dialog with it filled in.
 */
export function ApplePaySection({
	workspaceId,
	status,
}: {
	workspaceId: string;
	status: CaptureKeyStatus | null;
}) {
	const [key, setKey] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [isPending, startTransition] = useTransition();

	function newKey() {
		startTransition(async () => {
			const result = await createCaptureKey(workspaceId).catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
			else setKey(result.key);
		});
	}

	return (
		<div className="space-y-3">
			<p className="text-xs text-muted-foreground">
				{status
					? status.lastUsedAt
						? `Last payment ${ago(status.lastUsedAt)}`
						: "Waiting for the first payment"
					: "Off"}
			</p>
			<div className="flex flex-wrap gap-2">
				<Button variant="outline" className="gap-1.5" disabled={isPending} onClick={newKey}>
					{isPending && <Spinner />}
					{status ? "New key" : "Set up Apple Pay"}
				</Button>
				{status && (
					<Button
						variant="ghost"
						className="text-muted-foreground"
						disabled={isPending}
						onClick={() => setConfirming(true)}
					>
						Turn off
					</Button>
				)}
			</div>

			{key && (
				<div className="space-y-3 pt-2">
					<div className="space-y-2">
						<CopyRow label="URL" value={`${window.location.origin}/api/kuroji/capture`} />
						<CopyRow label="Authorization" value={`Bearer ${key}`} />
					</div>
					<p className="text-xs text-muted-foreground">
						The key is shown only now. A new key stops the old Shortcut.
					</p>
					<ol className="list-decimal space-y-1.5 pl-5 text-sm">
						<li>
							On the iPhone, open Shortcuts → Automation → New Automation → Apps → <b>Wallet</b>{" "}
							(“When I tap a Wallet card or pass”; <b>Transaction</b> before iOS 26). Pick your
							cards, choose <b>Run Immediately</b>, then New Blank Automation.
						</li>
						<li>
							Add <b>Get Contents of URL</b> with the URL above. Under Show More: Method <b>POST</b>
							, a header <b>Authorization</b> with the value above.
						</li>
						<li>
							Request Body <b>JSON</b>, three Text fields:{" "}
							<code className="font-mono text-xs">amount</code> → Shortcut Input · Amount,{" "}
							<code className="font-mono text-xs">merchant</code> → Merchant,{" "}
							<code className="font-mono text-xs">card</code> → Card or Pass. Tap Shortcut Input to
							pick each one.
						</li>
						<li>
							Turn on{" "}
							<Link href="/settings/notifications" className="underline underline-offset-2">
								notifications
							</Link>{" "}
							in the installed app: each payment sends a push that opens it filled in.
						</li>
					</ol>
				</div>
			)}

			<ConfirmDelete
				open={confirming}
				onOpenChange={setConfirming}
				confirmLabel="Turn off"
				title="Turn off Apple Pay?"
				description="The key stops working, so the Shortcut's payments are refused. Delete the automation on the iPhone too."
				onConfirm={async () => {
					const result = await deleteCaptureKey(workspaceId).catch(() => FAILED);
					if ("error" in result) toast.error(result.error);
					else setKey(null);
				}}
			/>
		</div>
	);
}
