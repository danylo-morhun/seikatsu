"use client";

import { resetPassword } from "@/features/auth/actions/password-reset";
import type { ResetState } from "@/features/auth/actions/password-reset";
import { Button } from "@seikatsu/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@seikatsu/ui/card";
import { Input } from "@seikatsu/ui/input";
import { Label } from "@seikatsu/ui/label";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Suspense } from "react";

function ResetPasswordForm() {
	const searchParams = useSearchParams();
	const token = searchParams.get("token") ?? "";
	const email = searchParams.get("email") ?? "";
	const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, null);

	if (!token || !email) {
		return (
			<p className="text-sm text-destructive">
				Invalid reset link.{" "}
				<Link href="/auth/forgot-password" className="underline underline-offset-2">
					Request a new one.
				</Link>
			</p>
		);
	}

	if (state && "success" in state) {
		return (
			<div className="space-y-3 text-center">
				<p className="text-sm text-muted-foreground">Password updated. You can now sign in.</p>
				<Link href="/" className="text-sm underline underline-offset-2">
					Sign in
				</Link>
			</div>
		);
	}

	return (
		<form action={action} className="space-y-4">
			<input type="hidden" name="token" value={token} />
			<input type="hidden" name="email" value={email} />
			<div className="space-y-1.5">
				<Label htmlFor="password">New password</Label>
				<Input
					id="password"
					name="password"
					type="password"
					minLength={8}
					placeholder="At least 8 characters"
					required
				/>
			</div>
			{state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
			<Button type="submit" className="w-full" disabled={pending}>
				{pending ? "Updating…" : "Set new password"}
			</Button>
		</form>
	);
}

export default function ResetPasswordPage() {
	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Reset password</CardTitle>
					<CardDescription>Enter your new password below.</CardDescription>
				</CardHeader>
				<CardContent>
					<Suspense>
						<ResetPasswordForm />
					</Suspense>
				</CardContent>
			</Card>
		</main>
	);
}
