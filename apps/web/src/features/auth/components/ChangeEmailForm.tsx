"use client";

import { Spinner } from "@/components/Spinner";
import { requestEmailChange } from "@/features/auth/actions/settings";
import type { SettingsState } from "@/features/auth/actions/settings";
import { Button } from "@seikatsu/ui/button";
import { Input } from "@seikatsu/ui/input";
import { Label } from "@seikatsu/ui/label";
import { useActionState, useId, useState } from "react";

interface Props {
	pendingEmail: string | null;
}

export function ChangeEmailForm({ pendingEmail }: Props) {
	const id = useId();
	const [email, setEmail] = useState("");
	const [state, action, pending] = useActionState<SettingsState, FormData>(
		requestEmailChange,
		null,
	);
	const sentTo = state && "success" in state ? email.trim() : pendingEmail;
	const ready = email.trim().length > 0;

	return (
		<form action={action} className="space-y-4">
			{sentTo && (
				<p className="text-sm text-muted-foreground">
					Waiting on <span className="text-foreground">{sentTo}</span>: open the link sent there to
					switch.
				</p>
			)}
			<div className="max-w-sm space-y-2">
				<Label htmlFor={`${id}-email`}>New email</Label>
				<Input
					id={`${id}-email`}
					name="newEmail"
					type="email"
					inputMode="email"
					autoComplete="email"
					placeholder="new@example.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					aria-invalid={(state && "error" in state) || undefined}
					required
				/>
				{state && "error" in state && (
					<p role="alert" className="text-[0.8rem] text-destructive">
						{state.error}
					</p>
				)}
			</div>
			<Button
				type="submit"
				variant={ready ? "default" : "outline"}
				disabled={pending || !ready}
				className="gap-1.5"
			>
				{pending && <Spinner />}
				{pending ? "Sending…" : "Send link"}
			</Button>
		</form>
	);
}
