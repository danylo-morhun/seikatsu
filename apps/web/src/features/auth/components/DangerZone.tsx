"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Spinner } from "@/components/Spinner";
import { deleteAccount, signOutAllDevices } from "@/features/auth/actions/settings";
import { Button } from "@seikatsu/ui/button";
import { useState, useTransition } from "react";

/** Signing out everywhere and deleting the account, as two hairline rows. */
export function DangerZone() {
	const [signingOut, startSignOut] = useTransition();
	const [confirming, setConfirming] = useState(false);

	return (
		<>
			<ul className="inset-group rounded-2xl bg-surface px-4 py-1 divide-y divide-rule [&>*:hover]:border-transparent [&>*:has(+*:hover)]:border-transparent">
				<li className="flex items-center gap-4 py-3">
					<div className="min-w-0 flex-1">
						<p className="text-sm">Sign out everywhere</p>
						<p className="text-xs text-muted-foreground">
							Every browser and phone, this one included.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						disabled={signingOut}
						onClick={() => startSignOut(() => signOutAllDevices())}
						className="shrink-0 gap-1.5"
					>
						{signingOut && <Spinner />}
						{signingOut ? "Signing out…" : "Sign out"}
					</Button>
				</li>
				<li className="flex items-center gap-4 py-3">
					<div className="min-w-0 flex-1">
						<p className="text-sm">Delete account</p>
						<p className="text-xs text-muted-foreground">
							Your account and everything in every app, for good.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setConfirming(true)}
						className="shrink-0 text-destructive hover:text-destructive"
					>
						Delete…
					</Button>
				</li>
			</ul>
			<ConfirmDelete
				open={confirming}
				onOpenChange={setConfirming}
				title="Delete your account?"
				description="Finances, boards, books, habits, applications and the car go with it. This can't be undone."
				confirmLabel="Delete everything"
				onConfirm={() => deleteAccount()}
			/>
		</>
	);
}
