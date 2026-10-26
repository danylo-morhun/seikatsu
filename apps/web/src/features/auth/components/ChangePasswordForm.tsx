"use client";

import { Spinner } from "@/components/Spinner";
import { changePassword } from "@/features/auth/actions/settings";
import type { SettingsState } from "@/features/auth/actions/settings";
import { Button } from "@seikatsu/ui/button";
import { Input } from "@seikatsu/ui/input";
import { Label } from "@seikatsu/ui/label";
import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";

interface Props {
	hasPassword: boolean;
}

export function ChangePasswordForm({ hasPassword }: Props) {
	const id = useId();
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [state, action, pending] = useActionState<SettingsState, FormData>(changePassword, null);

	// A saved password leaves the form empty again; once per result, not when hasPassword flips.
	useEffect(() => {
		if (state && "success" in state) {
			toast.success(hasPassword ? "Password changed" : "Password set");
			setCurrent("");
			setNext("");
		}
	}, [state]);

	const ready = next.length >= 8 && (!hasPassword || current.length > 0);
	const error = state && "error" in state ? state.error : null;

	return (
		<form action={action} className="space-y-4">
			<div className="grid max-w-xl gap-4 sm:grid-cols-2">
				{hasPassword && (
					<div className="space-y-2">
						<Label htmlFor={`${id}-current`}>Current password</Label>
						<Input
							id={`${id}-current`}
							name="currentPassword"
							type="password"
							autoComplete="current-password"
							value={current}
							onChange={(e) => setCurrent(e.target.value)}
							required
						/>
					</div>
				)}
				<div className="space-y-2">
					<Label htmlFor={`${id}-new`}>{hasPassword ? "New password" : "Password"}</Label>
					<Input
						id={`${id}-new`}
						name="newPassword"
						type="password"
						autoComplete="new-password"
						minLength={8}
						placeholder="8 characters or more"
						value={next}
						onChange={(e) => setNext(e.target.value)}
						required
					/>
				</div>
			</div>
			{error && (
				<p role="alert" className="text-[0.8rem] text-destructive">
					{error}
				</p>
			)}
			<Button
				type="submit"
				variant={ready ? "default" : "outline"}
				disabled={pending || !ready}
				className="gap-1.5"
			>
				{pending && <Spinner />}
				{pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
			</Button>
		</form>
	);
}
