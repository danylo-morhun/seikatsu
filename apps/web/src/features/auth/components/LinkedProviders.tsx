"use client";

import { Spinner } from "@/components/Spinner";
import { unlinkProvider } from "@/features/auth/actions/settings";
import type { SettingsState } from "@/features/auth/actions/settings";
import { Button } from "@seikatsu/ui/button";
import { useActionState } from "react";

const PROVIDER_LABELS: Record<string, string> = {
	github: "GitHub",
	google: "Google",
	resend: "Email link",
};

function ProviderRow({ provider, canUnlink }: { provider: string; canUnlink: boolean }) {
	const [state, action, pending] = useActionState<SettingsState, FormData>(unlinkProvider, null);
	const label = PROVIDER_LABELS[provider] ?? provider;
	return (
		<li className="flex min-h-12 items-center gap-3 py-1.5">
			<div className="min-w-0 flex-1">
				<p className="text-sm">{label}</p>
				{state && "error" in state && (
					<p role="alert" className="text-xs text-destructive">
						{state.error}
					</p>
				)}
			</div>
			{canUnlink && (
				<form action={action}>
					<input type="hidden" name="provider" value={provider} />
					<Button
						type="submit"
						variant="ghost"
						size="sm"
						disabled={pending}
						aria-label={`Unlink ${label}`}
						className="gap-1.5 text-muted-foreground hover:text-foreground"
					>
						{pending && <Spinner />}
						{pending ? "Unlinking…" : "Unlink"}
					</Button>
				</form>
			)}
		</li>
	);
}

/** Every way in, as hairline rows; any but the last one can be unlinked. */
export function LinkedProviders({
	providers,
	hasPassword,
}: {
	providers: string[];
	hasPassword: boolean;
}) {
	const canUnlink = providers.length + (hasPassword ? 1 : 0) > 1;

	return (
		<ul className="divide-y divide-rule">
			{providers.map((provider) => (
				<ProviderRow key={provider} provider={provider} canUnlink={canUnlink} />
			))}
			{hasPassword && (
				<li className="flex min-h-12 items-center py-1.5">
					<p className="text-sm">Email and password</p>
				</li>
			)}
		</ul>
	);
}
