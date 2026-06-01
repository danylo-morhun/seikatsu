"use client";

import { requestPasswordReset } from "@/features/auth/actions/password-reset";
import type { ResetState } from "@/features/auth/actions/password-reset";
import { Button } from "@seikatsu/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@seikatsu/ui/card";
import { Input } from "@seikatsu/ui/input";
import { Label } from "@seikatsu/ui/label";
import Link from "next/link";
import { useActionState } from "react";

export default function ForgotPasswordPage() {
	const [state, action, pending] = useActionState<ResetState, FormData>(requestPasswordReset, null);

	if (state && "success" in state) {
		return (
			<main className="flex min-h-screen items-center justify-center p-4">
				<Card className="w-full max-w-sm text-center">
					<CardHeader>
						<CardTitle>Check your email</CardTitle>
						<CardDescription>
							If an account with a password exists for that email, we sent a reset link.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Link href="/" className="text-sm underline underline-offset-2">
							Back to sign in
						</Link>
					</CardContent>
				</Card>
			</main>
		);
	}

	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Forgot password</CardTitle>
					<CardDescription>Enter your email and we&apos;ll send a reset link.</CardDescription>
				</CardHeader>
				<CardContent>
					<form action={action} className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="email">Email</Label>
							<Input id="email" name="email" type="email" placeholder="you@example.com" required />
						</div>
						{state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
						<Button type="submit" className="w-full" disabled={pending}>
							{pending ? "Sending…" : "Send reset link"}
						</Button>
						<p className="text-center text-sm text-muted-foreground">
							<Link href="/" className="underline underline-offset-2">
								Back to sign in
							</Link>
						</p>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
