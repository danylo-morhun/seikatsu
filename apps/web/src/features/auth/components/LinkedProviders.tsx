"use client";

import { Spinner } from "@/components/Spinner";
import { unlinkProvider } from "@/features/auth/actions/settings";
import type { SettingsState } from "@/features/auth/actions/settings";
import { Button } from "@seikatsu/ui/button";
import { Unlink01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useActionState } from "react";

const PROVIDER_LABELS: Record<string, string> = {
	github: "GitHub",
	google: "Google",
	resend: "Magic link (email)",
};

interface ProviderRowProps {
	provider: string;
	canUnlink: boolean;
}

function ProviderRow({ provider, canUnlink }: ProviderRowProps) {
	const [state, action, pending] = useActionState<SettingsState, FormData>(unlinkProvider, null);
	return (
		<div className="flex items-center justify-between py-2.5">
			<div className="flex items-center gap-2">
				<span className="text-sm font-medium">{PROVIDER_LABELS[provider] ?? provider}</span>
				<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
					Connected
				</span>
			</div>
			<div className="flex items-center gap-2">
				{state && "error" in state && <p className="text-xs text-destructive">{state.error}</p>}
				{canUnlink && (
					<form action={action}>
						<input type="hidden" name="provider" value={provider} />
						<Button
							type="submit"
							variant="ghost"
							size="sm"
							disabled={pending}
							className="h-7 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
						>
							{pending ? (
								<Spinner />
							) : (
								<HugeiconsIcon icon={Unlink01Icon} className="h-3.5 w-3.5" />
							)}
							{pending ? "Unlinking…" : "Unlink"}
						</Button>
					</form>
				)}
			</div>
		</div>
	);
}

interface Props {
	providers: string[];
	hasPassword: boolean;
}

export function LinkedProviders({ providers, hasPassword }: Props) {
	const totalMethods = providers.length + (hasPassword ? 1 : 0);

	return (
		<div className="divide-y divide-border">
			{providers.map((provider) => (
				<ProviderRow key={provider} provider={provider} canUnlink={totalMethods > 1} />
			))}
			{hasPassword && (
				<div className="flex items-center justify-between py-2.5">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium">Password</span>
						<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
							Set
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
