"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Spinner } from "@/components/Spinner";
import { Button } from "@seikatsu/ui";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { type MailKeyStatus, createMailKey, deleteMailKey } from "../actions/mail";
import { mailScript } from "../lib/mail-script";

const FAILED = { error: "Couldn't save. Check your connection." } as const;

function ago(iso: string): string {
	const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 48) return `${hours} h ago`;
	return `${Math.round(hours / 24)} days ago`;
}

/**
 * Settings: mail sync. A key, and the Apps Script that carries it; the script runs in the
 * user's own Google account and posts new mail here every 30 minutes.
 */
export function SettingsMail({ status }: { status: MailKeyStatus | null }) {
	const id = useId();
	const [script, setScript] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [isPending, startTransition] = useTransition();

	function newKey() {
		startTransition(async () => {
			const result = await createMailKey().catch(() => FAILED);
			if ("error" in result) {
				toast.error(result.error);
				return;
			}
			setScript(mailScript(`${window.location.origin}/api/kyuu/mail`, result.data.key));
		});
	}

	return (
		<section aria-labelledby={`${id}-title`} className="mt-10">
			<div className="mb-3 flex items-baseline justify-between gap-3">
				<h2 id={`${id}-title`} className="text-sm font-medium">
					Mail
				</h2>
				<span className="text-xs text-muted-foreground">
					{status
						? status.lastSyncAt
							? `Synced ${ago(status.lastSyncAt)}`
							: "Waiting for the first sync"
						: "Off"}
				</span>
			</div>
			<div className="space-y-3 border-y border-rule py-3">
				<p className="max-w-xl text-sm text-muted-foreground">
					A Google Apps Script in your Gmail sends Kyuu the last three days of mail every 30
					minutes. Gemini reads only mail that names a company you applied to (or comes from a
					hiring platform): clear answers move the application on their own, unsure ones wait above
					the table.
				</p>
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" className="gap-1.5" disabled={isPending} onClick={newKey}>
						{isPending && <Spinner />}
						{status ? "New key and script" : "Set up mail sync"}
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

				{script && (
					<div className="space-y-3 pt-2">
						<ol className="list-decimal space-y-1 pl-5 text-sm">
							<li>
								Open{" "}
								<a
									href="https://script.google.com/home/projects/create"
									target="_blank"
									rel="noopener noreferrer"
									className="underline underline-offset-2"
								>
									a new Apps Script project
								</a>{" "}
								signed in as the Gmail account to read.
							</li>
							<li>Replace everything in Code.gs with the script below and save.</li>
							<li>
								Pick <code className="font-mono text-xs">install</code> in the toolbar, press Run
								and allow access.
							</li>
						</ol>
						<p className="text-xs text-muted-foreground">
							The key is in the script and shown only now. A new key stops the old script.
						</p>
						<div className="relative">
							<pre className="max-h-64 overflow-auto rounded-md bg-surface p-3 font-mono text-xs leading-relaxed">
								{script}
							</pre>
							<Button
								size="sm"
								variant="outline"
								className="absolute top-2 right-2"
								onClick={() =>
									navigator.clipboard
										.writeText(script)
										.then(() => toast.success("Script copied"))
										.catch(() => toast.error("Couldn't copy"))
								}
							>
								Copy
							</Button>
						</div>
					</div>
				)}
			</div>

			<ConfirmDelete
				open={confirming}
				onOpenChange={setConfirming}
				confirmLabel="Turn off"
				title="Turn off mail sync?"
				description="The key stops working, so the script's runs are refused. Remove its trigger in Apps Script too."
				onConfirm={async () => {
					const result = await deleteMailKey().catch(() => FAILED);
					if ("error" in result) toast.error(result.error);
					else setScript(null);
				}}
			/>
		</section>
	);
}
