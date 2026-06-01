"use client";

import { Spinner } from "@/components/Spinner";
import { changePassword } from "@/features/auth/actions/settings";
import type { SettingsState } from "@/features/auth/actions/settings";
import { Button } from "@seikatsu/ui/button";
import { Input } from "@seikatsu/ui/input";
import { Label } from "@seikatsu/ui/label";
import { useActionState } from "react";

interface Props {
	hasPassword: boolean;
}

export function ChangePasswordForm({ hasPassword }: Props) {
	const [state, action, pending] = useActionState<SettingsState, FormData>(changePassword, null);

	return (
		<form action={action} className="space-y-4">
			{hasPassword && (
				<div className="space-y-1.5">
					<Label htmlFor="currentPassword">Current password</Label>
					<Input id="currentPassword" name="currentPassword" type="password" required />
				</div>
			)}
			<div className="space-y-1.5">
				<Label htmlFor="newPassword">{hasPassword ? "New password" : "Password"}</Label>
				<Input
					id="newPassword"
					name="newPassword"
					type="password"
					minLength={8}
					placeholder="At least 8 characters"
					required
				/>
			</div>
			{state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
			{state && "success" in state && (
				<p className="text-sm text-green-500">
					{hasPassword ? "Password updated." : "Password set."}
				</p>
			)}
			<Button type="submit" disabled={pending} className="gap-1.5">
				{pending && <Spinner />}
				{pending ? "Saving…" : hasPassword ? "Update password" : "Set password"}
			</Button>
		</form>
	);
}
