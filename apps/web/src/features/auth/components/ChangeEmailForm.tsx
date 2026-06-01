"use client";

import { Spinner } from "@/components/Spinner";
import { requestEmailChange } from "@/features/auth/actions/settings";
import type { SettingsState } from "@/features/auth/actions/settings";
import { Button } from "@seikatsu/ui/button";
import { Input } from "@seikatsu/ui/input";
import { Label } from "@seikatsu/ui/label";
import { useActionState } from "react";

interface Props {
	currentEmail: string | null;
	pendingEmail: string | null;
}

export function ChangeEmailForm({ currentEmail, pendingEmail }: Props) {
	const [state, action, pending] = useActionState<SettingsState, FormData>(
		requestEmailChange,
		null,
	);

	if (state && "success" in state) {
		return (
			<p className="py-2 text-sm text-muted-foreground">
				Verification link sent to your new email. Click it to confirm the change.
			</p>
		);
	}

	return (
		<form action={action} className="space-y-4">
			{pendingEmail && (
				<p className="text-sm text-muted-foreground">
					Pending change to <span className="font-medium text-foreground">{pendingEmail}</span> —
					check that inbox for a verification link.
				</p>
			)}
			<div className="space-y-1.5">
				<Label htmlFor="newEmail">New email address</Label>
				<Input
					id="newEmail"
					name="newEmail"
					type="email"
					placeholder={currentEmail ?? "you@example.com"}
					required
				/>
			</div>
			{state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
			<Button type="submit" disabled={pending} className="gap-1.5">
				{pending && <Spinner />}
				{pending ? "Sending…" : "Send verification link"}
			</Button>
		</form>
	);
}
