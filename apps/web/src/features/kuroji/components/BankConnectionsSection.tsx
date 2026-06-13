"use client";

import { Spinner } from "@/components/Spinner";
import type { getAccounts } from "@/features/kuroji/actions/accounts";
import type { getBankConnections } from "@/features/kuroji/actions/bank";
import {
	connectBank,
	deleteBankConnection,
	linkBankAccount,
	listBankInstitutions,
	syncBankConnection,
} from "@/features/kuroji/actions/bank";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Account = Awaited<ReturnType<typeof getAccounts>>[number];
type Connection = Awaited<ReturnType<typeof getBankConnections>>[number];
type Institution = { id: string; name: string; logo?: string };

const NONE = "__none__";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
	CREATED: { text: "Awaiting authorization", cls: "text-amber-500" },
	LINKED: { text: "Connected", cls: "text-green-500" },
	EXPIRED: { text: "Access expired — reconnect", cls: "text-destructive" },
	ERROR: { text: "Sync error", cls: "text-destructive" },
};

export function BankConnectionsSection({
	workspaceId,
	connections,
	accounts,
}: {
	workspaceId: string;
	connections: Connection[];
	accounts: Account[];
}) {
	const router = useRouter();
	const linkTargets = accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY");

	return (
		<div className="space-y-4">
			{connections.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No banks connected. Connect your bank to import transactions automatically.
				</p>
			) : (
				<div className="space-y-3">
					{connections.map((conn) => (
						<ConnectionCard
							key={conn.id}
							connection={conn}
							linkTargets={linkTargets}
							workspaceId={workspaceId}
							onChanged={() => router.refresh()}
						/>
					))}
				</div>
			)}
			<ConnectBankDialog workspaceId={workspaceId} />
		</div>
	);
}

function ConnectionCard({
	connection,
	linkTargets,
	workspaceId,
	onChanged,
}: {
	connection: Connection;
	linkTargets: Account[];
	workspaceId: string;
	onChanged: () => void;
}) {
	const [isPending, startTransition] = useTransition();
	const [action, setAction] = useState<"sync" | "delete" | null>(null);
	const status = STATUS_LABEL[connection.status] ?? { text: connection.status, cls: "" };

	function handleSync() {
		setAction("sync");
		startTransition(async () => {
			const result = await syncBankConnection(connection.id);
			if ("error" in result) toast.error(result.error);
			else toast.success(`Imported ${result.imported} transaction(s).`);
			setAction(null);
			onChanged();
		});
	}

	function handleDelete() {
		if (!confirm(`Disconnect ${connection.displayName}? Imported transactions are kept.`)) {
			return;
		}
		setAction("delete");
		startTransition(async () => {
			const result = await deleteBankConnection(connection.id);
			if ("error" in result) toast.error(result.error);
			else toast.success("Bank disconnected.");
			setAction(null);
			onChanged();
		});
	}

	function handleLink(accountUid: string, value: string) {
		startTransition(async () => {
			const result = await linkBankAccount(workspaceId, accountUid, value === NONE ? null : value);
			if ("error" in result) toast.error(result.error);
			else toast.success("Account link updated.");
			onChanged();
		});
	}

	return (
		<div className="rounded-md border p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="font-medium">{connection.displayName}</p>
					<p className={`text-xs ${status.cls}`}>{status.text}</p>
					{connection.lastSyncedAt && (
						<p className="text-xs text-muted-foreground">
							Last synced {new Date(connection.lastSyncedAt).toLocaleString()}
						</p>
					)}
					{connection.lastError && connection.status === "ERROR" && (
						<p className="mt-1 text-xs text-destructive">{connection.lastError}</p>
					)}
				</div>
				<div className="flex shrink-0 gap-2">
					<Button
						size="sm"
						variant="outline"
						onClick={handleSync}
						disabled={isPending || connection.status === "CREATED"}
						className="gap-1.5"
					>
						{isPending && action === "sync" && <Spinner />}
						{isPending && action === "sync" ? "Syncing…" : "Sync now"}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={handleDelete}
						disabled={isPending}
						className="gap-1.5 text-destructive"
					>
						{isPending && action === "delete" ? "Removing…" : "Disconnect"}
					</Button>
				</div>
			</div>

			{connection.bankAccounts.length > 0 && (
				<div className="mt-3 space-y-2 border-t pt-3">
					{connection.bankAccounts.map((ba) => (
						<div key={ba.id} className="flex items-center justify-between gap-3">
							<div className="min-w-0">
								<p className="truncate text-sm">{ba.name}</p>
								{ba.iban && (
									<p className="truncate text-xs text-muted-foreground font-mono">{ba.iban}</p>
								)}
							</div>
							<Select
								value={ba.accountId ?? NONE}
								onValueChange={(v) => handleLink(ba.accountUid, v)}
							>
								<SelectTrigger className="w-48">
									<SelectValue placeholder="Not linked" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE}>Not linked</SelectItem>
									{linkTargets.map((a) => (
										<SelectItem key={a.id} value={a.id}>
											{a.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function ConnectBankDialog({ workspaceId }: { workspaceId: string }) {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [query, setQuery] = useState("");
	const [institutions, setInstitutions] = useState<Institution[]>([]);
	const [connectingId, setConnectingId] = useState<string | null>(null);
	const [importFrom, setImportFrom] = useState("");

	async function loadInstitutions() {
		setLoading(true);
		const result = await listBankInstitutions("PL");
		setLoading(false);
		if ("error" in result) {
			toast.error(result.error);
			return;
		}
		setInstitutions(result.institutions);
	}

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (next && institutions.length === 0) void loadInstitutions();
	}

	async function handleConnect(inst: Institution) {
		setConnectingId(inst.id);
		const result = await connectBank(workspaceId, inst.name, "PL", importFrom || undefined);
		if ("error" in result) {
			toast.error(result.error);
			setConnectingId(null);
			return;
		}
		// Redirect the user to the bank's authorization page.
		window.location.href = result.link;
	}

	const filtered = query
		? institutions.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
		: institutions;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button size="sm">Connect a bank</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[80vh] overflow-hidden">
				<DialogHeader>
					<DialogTitle>Connect a Polish bank</DialogTitle>
					<DialogDescription>
						Pick your bank. You&apos;ll be redirected to authorize read-only access via Open Banking
						(PSD2).
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-1.5">
					<Label htmlFor="import-from">Import transactions from</Label>
					<Input
						id="import-from"
						type="date"
						value={importFrom}
						onChange={(e) => setImportFrom(e.target.value)}
						className="w-44"
					/>
					<p className="text-xs text-muted-foreground">
						Leave empty for full history (up to ~730 days).
					</p>
				</div>
				<Input
					placeholder="Search (e.g. Pekao)"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
				<div className="max-h-[50vh] space-y-1 overflow-y-auto">
					{loading && (
						<div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
							<Spinner /> Loading banks…
						</div>
					)}
					{!loading && filtered.length === 0 && (
						<p className="p-3 text-sm text-muted-foreground">No banks found.</p>
					)}
					{!loading &&
						filtered.map((inst) => (
							<button
								key={inst.id}
								type="button"
								onClick={() => handleConnect(inst)}
								disabled={connectingId !== null}
								className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
							>
								{inst.logo ? (
									<img src={inst.logo} alt="" className="h-6 w-6 rounded" />
								) : (
									<div className="h-6 w-6 rounded bg-muted" />
								)}
								<span className="flex-1">{inst.name}</span>
								{connectingId === inst.id && <Spinner />}
							</button>
						))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
