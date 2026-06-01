"use client";

import { Spinner } from "@/components/Spinner";
import {
	handleCredentials,
	signInWithGitHub,
	signInWithGoogle,
	signInWithMagicLink,
} from "@/features/auth/actions/auth";
import type { AuthState } from "@/features/auth/actions/auth";
import { Button } from "@seikatsu/ui/button";
import { Card, CardContent } from "@seikatsu/ui/card";
import { Input } from "@seikatsu/ui/input";
import { Label } from "@seikatsu/ui/label";
import { Separator } from "@seikatsu/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@seikatsu/ui/tabs";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

function LogoMark() {
	return (
		<div className="mb-6 flex flex-col items-center gap-3 text-center">
			<Image src="/icons/favicon.svg" alt="seikatsu" width={52} height={52} />
			<h1 className="text-2xl font-semibold tracking-tight">seikatsu</h1>
		</div>
	);
}

function GitHubButton() {
	const [pending, setPending] = useState(false);
	return (
		<form
			action={async () => {
				setPending(true);
				await signInWithGitHub();
			}}
		>
			<Button className="w-full gap-1.5" variant="outline" type="submit" disabled={pending}>
				{pending ? (
					<Spinner />
				) : (
					<svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
					</svg>
				)}
				{pending ? "Redirecting…" : "GitHub"}
			</Button>
		</form>
	);
}

function GoogleButton() {
	const [pending, setPending] = useState(false);
	return (
		<form
			action={async () => {
				setPending(true);
				await signInWithGoogle();
			}}
		>
			<Button className="w-full gap-1.5" variant="outline" type="submit" disabled={pending}>
				{pending ? (
					<Spinner />
				) : (
					<svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
						<path
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							fill="#4285F4"
						/>
						<path
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							fill="#34A853"
						/>
						<path
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
							fill="#FBBC05"
						/>
						<path
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							fill="#EA4335"
						/>
					</svg>
				)}
				{pending ? "Redirecting…" : "Google"}
			</Button>
		</form>
	);
}

function MagicLinkForm() {
	const [state, action, pending] = useActionState<AuthState, FormData>(signInWithMagicLink, null);

	if (state && "success" in state) {
		return (
			<div className="bg-muted rounded-lg px-4 py-5 text-center">
				<p className="text-sm font-medium">Check your inbox</p>
				<p className="text-muted-foreground mt-1 text-xs">Magic link sent to your email.</p>
			</div>
		);
	}

	return (
		<form action={action} className="space-y-3">
			<div className="space-y-1.5">
				<Label htmlFor="magic-email">Email</Label>
				<Input id="magic-email" name="email" type="email" placeholder="you@example.com" required />
			</div>
			{state && "error" in state && <p className="text-destructive text-sm">{state.error}</p>}
			<Button className="w-full gap-1.5" type="submit" disabled={pending}>
				{pending && <Spinner />}
				{pending ? "Sending…" : "Send magic link"}
			</Button>
		</form>
	);
}

function PasswordForm() {
	const [mode, setMode] = useState<"signin" | "signup">("signin");
	const [state, action, pending] = useActionState<AuthState, FormData>(handleCredentials, null);

	return (
		<form action={action} className="space-y-3">
			<input type="hidden" name="mode" value={mode} />
			{mode === "signup" && (
				<div className="space-y-1.5">
					<Label htmlFor="cred-name">Name</Label>
					<Input id="cred-name" name="name" type="text" placeholder="Your name" required />
				</div>
			)}
			<div className="space-y-1.5">
				<Label htmlFor="cred-email">Email</Label>
				<Input id="cred-email" name="email" type="email" placeholder="you@example.com" required />
			</div>
			<div className="space-y-1.5">
				<div className="flex items-center justify-between">
					<Label htmlFor="cred-password">Password</Label>
					{mode === "signin" && (
						<Link
							href="/auth/forgot-password"
							className="text-primary text-xs hover:underline underline-offset-2"
						>
							Forgot password?
						</Link>
					)}
				</div>
				<Input
					id="cred-password"
					name="password"
					type="password"
					placeholder="••••••••"
					required
					minLength={8}
				/>
			</div>
			{state && "error" in state && <p className="text-destructive text-sm">{state.error}</p>}
			<Button className="w-full gap-1.5" type="submit" disabled={pending}>
				{pending && <Spinner />}
				{pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
			</Button>
			<p className="text-muted-foreground text-center text-sm">
				{mode === "signin" ? (
					<>
						No account?{" "}
						<button
							type="button"
							className="text-primary hover:underline underline-offset-2"
							onClick={() => setMode("signup")}
						>
							Sign up
						</button>
					</>
				) : (
					<>
						Have an account?{" "}
						<button
							type="button"
							className="text-primary hover:underline underline-offset-2"
							onClick={() => setMode("signin")}
						>
							Sign in
						</button>
					</>
				)}
			</p>
		</form>
	);
}

export function SignInCard() {
	return (
		<Card className="ring-border/60 w-full max-w-md ring-1">
			<CardContent className="space-y-5 px-8 pt-8 pb-8">
				<LogoMark />
				<div className="grid grid-cols-2 gap-3">
					<GitHubButton />
					<GoogleButton />
				</div>
				<div className="flex items-center gap-3">
					<Separator className="flex-1" />
					<span className="text-muted-foreground text-xs">or continue with</span>
					<Separator className="flex-1" />
				</div>
				<Tabs defaultValue="magic">
					<TabsList className="w-full">
						<TabsTrigger value="magic" className="flex-1">
							Magic link
						</TabsTrigger>
						<TabsTrigger value="password" className="flex-1">
							Password
						</TabsTrigger>
					</TabsList>
					<TabsContent value="magic" className="pt-3">
						<MagicLinkForm />
					</TabsContent>
					<TabsContent value="password" className="pt-3">
						<PasswordForm />
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
