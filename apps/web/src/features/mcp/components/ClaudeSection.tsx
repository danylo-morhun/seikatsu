"use client";

import { Button, Checkbox, Input, Label } from "@seikatsu/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Spinner } from "@/components/Spinner";
import { createClaudeToken, revokeClaudeAccess } from "@/features/mcp/actions/grants";
import type { GrantRow, WriteRow } from "@/features/mcp/lib/grants-data";

const FAILED = { error: "Couldn't save. Check your connection." } as const;

function ago(iso: string | null): string {
	if (!iso) return "never used";
	const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
	if (minutes < 1) return "used just now";
	if (minutes < 60) return `used ${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 48) return `used ${hours} h ago`;
	return `used ${Math.round(hours / 24)} days ago`;
}

function CopyRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
			<code className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-1.5 font-mono text-xs">
				{value}
			</code>
			<Button
				size="sm"
				variant="outline"
				onClick={() =>
					navigator.clipboard
						.writeText(value)
						.then(() => toast.success(`${label} copied`))
						.catch(() => toast.error("Couldn't copy"))
				}
			>
				Copy
			</Button>
		</div>
	);
}

/**
 * Settings: Claude. What's connected over MCP (claude.ai, Claude Code, personal tokens),
 * disconnecting, a personal token for scripts, and the last changes Claude made.
 */
export function ClaudeSection({
	url,
	grants,
	writes,
}: {
	/** The MCP endpoint on the origin the page was served from. */
	url: string;
	grants: GrantRow[];
	writes: WriteRow[];
}) {
	const [revoking, setRevoking] = useState<GrantRow | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [name, setName] = useState("Claude Code");
	const [write, setWrite] = useState(true);
	const [isPending, startTransition] = useTransition();

	function newToken() {
		startTransition(async () => {
			const result = await createClaudeToken({ name, write }).catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
			else setToken(result.token);
		});
	}

	return (
		<div className="space-y-5">
			<div className="space-y-2">
				<CopyRow label="MCP URL" value={url} />
				<p className="text-xs text-muted-foreground">
					claude.ai: Settings → Connectors → Add custom connector → this URL. Claude Code:{" "}
					<code className="font-mono">claude mcp add --transport http seikatsu {url}</code>, then{" "}
					<code className="font-mono">/mcp</code> to sign in.
				</p>
			</div>

			{grants.length > 0 && (
				<ul className="inset-group">
					{grants.map((g) => (
						<li key={g.id} className="flex min-h-12 items-center gap-3 py-1.5">
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm">{g.name}</p>
								<p className="text-xs text-muted-foreground">
									{g.personal ? "Token" : "Connected"} · {g.write ? "read and change" : "read only"}{" "}
									· {ago(g.lastUsedAt)}
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								className="text-muted-foreground hover:text-foreground"
								onClick={() => setRevoking(g)}
							>
								Disconnect
							</Button>
						</li>
					))}
				</ul>
			)}

			<div className="space-y-3">
				<p className="text-sm font-medium">Personal token</p>
				<p className="text-xs text-muted-foreground">
					For scripts or a client without sign-in: sent as a Bearer header, works until
					disconnected.
				</p>
				<div className="flex flex-wrap items-end gap-3">
					<div className="min-w-48 flex-1 space-y-1.5">
						<Label htmlFor="claude-token-name">Name</Label>
						<Input
							id="claude-token-name"
							value={name}
							maxLength={60}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>
					<div className="flex h-9 items-center gap-2">
						<Checkbox
							id="claude-token-write"
							checked={write}
							onCheckedChange={(v) => setWrite(v === true)}
						/>
						<Label htmlFor="claude-token-write" className="font-normal">
							Can make changes
						</Label>
					</div>
					<Button
						variant="outline"
						className="gap-1.5"
						disabled={isPending || !name.trim()}
						onClick={newToken}
					>
						{isPending && <Spinner />}
						New token
					</Button>
				</div>
				{token && (
					<div className="space-y-2 pt-1">
						<CopyRow label="Authorization" value={`Bearer ${token}`} />
						<CopyRow
							label="Claude Code"
							value={`claude mcp add --transport http seikatsu ${url} --header "Authorization: Bearer ${token}"`}
						/>
						<p className="text-xs text-muted-foreground">The token is shown only now.</p>
					</div>
				)}
			</div>

			{writes.length > 0 && (
				<div className="space-y-2">
					<p className="text-sm font-medium">Recent changes by Claude</p>
					<ul className="inset-group text-sm">
						{writes.map((w) => (
							<li key={w.id} className="flex min-h-10 items-center gap-3 py-1">
								<span className="min-w-0 flex-1 truncate font-mono text-xs">{w.tool}</span>
								<span className="shrink-0 text-xs text-muted-foreground">
									{w.ok ? "" : "failed · "}
									{w.grant} · {new Date(w.at).toLocaleString()}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<ConfirmDelete
				open={revoking !== null}
				onOpenChange={(open) => !open && setRevoking(null)}
				confirmLabel="Disconnect"
				title={`Disconnect ${revoking?.name ?? ""}?`}
				description="Its access ends at once. Connect it again any time."
				onConfirm={async () => {
					if (!revoking) return;
					const result = await revokeClaudeAccess(revoking.id).catch(() => FAILED);
					if ("error" in result) toast.error(result.error);
					setRevoking(null);
				}}
			/>
		</div>
	);
}
