"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Spinner } from "@/components/Spinner";
import type { getAccounts } from "@/features/kuroji/actions/accounts";
import type { getBankConnections } from "@/features/kuroji/actions/bank";
import {
	connectBank,
	deleteBankConnection,
	linkBankAccount,
	listBankInstitutions,
	resetAndResync,
	syncBankConnection,
} from "@/features/kuroji/actions/bank";
import { formatDateTime } from "@/features/kuroji/lib/dates";
import { Delete01Icon, MoreHorizontalIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@seikatsu/ui";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Account = Awaited<ReturnType<typeof getAccounts>>[number];
type Connection = Awaited<ReturnType<typeof getBankConnections>>[number];
type Institution = { id: string; name: string; logo?: string };

const NONE = "__none__";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
	CREATED: { text: "Awaiting authorization", cls: "text-muted-foreground" },
	LINKED: { text: "Connected", cls: "text-muted-foreground" },
	EXPIRED: { text: "Access expired. Connect the bank again to resume.", cls: "text-destructive" },
	ERROR: { text: "Last sync failed", cls: "text-destructive" },
};

const transactions = (n: number) => `${n} ${n === 1 ? "transaction" : "transactions"}`;

export function BankConnectionsSection({
	workspaceId,
	connections,
	accounts,
}: {
	workspaceId: string;
	connections: Connection[];
	accounts: Account[];
}) {
	const linkTargets = accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY");

	return (
		<>
			{connections.length === 0 ? (
				<p className="py-4 text-sm text-muted-foreground">
					None yet. A connected bank sends its transactions here every day, filed by your import
					rules.
				</p>
			) : (
				<div className="divide-y divide-rule">
					{connections.map((conn) => (
						<ConnectionCard
							key={conn.id}
							connection={conn}
							linkTargets={linkTargets}
							workspaceId={workspaceId}
						/>
					))}
				</div>
			)}
		</>
	);
}

function ConnectionCard({
	connection,
	linkTargets,
	workspaceId,
}: {
	connection: Connection;
	linkTargets: Account[];
	workspaceId: string;
}) {
	const [isPending, startTransition] = useTransition();
	const [action, setAction] = useState<"sync" | "delete" | "reset" | null>(null);
	const [confirming, setConfirming] = useState<"delete" | "reset" | null>(null);
	const status = STATUS_LABEL[connection.status] ?? { text: connection.status, cls: "" };

	function handleSync() {
		setAction("sync");
		startTransition(async () => {
			const result = await syncBankConnection(connection.id);
			if ("error" in result) toast.error(result.error);
			else
				toast.success(
					result.imported ? `${transactions(result.imported)} imported` : "Nothing new to import",
				);
			setAction(null);
		});
	}

	async function handleReset() {
		const result = await resetAndResync(connection.id);
		if ("error" in result) toast.error(result.error);
		else toast.success(`${transactions(result.imported)} imported again`);
	}

	async function handleDelete() {
		const result = await deleteBankConnection(connection.id);
		if ("error" in result) toast.error(result.error);
		else toast.success(`${connection.displayName} disconnected`);
	}

	function handleLink(accountUid: string, value: string) {
		startTransition(async () => {
			const result = await linkBankAccount(workspaceId, accountUid, value === NONE ? null : value);
			if ("error" in result) toast.error(result.error);
		});
	}

	return (
		<div className="py-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-sm font-medium">{connection.displayName}</p>
					<p className={`text-xs ${status.cls}`}>{status.text}</p>
					{connection.lastSyncedAt && (
						<p className="text-xs text-muted-foreground">
							Last synced{" "}
							{/* Server renders in its own time zone; the browser re-renders in the user's. */}
							<time
								dateTime={new Date(connection.lastSyncedAt).toISOString()}
								suppressHydrationWarning
							>
								{formatDateTime(new Date(connection.lastSyncedAt))}
							</time>
						</p>
					)}
					{connection.lastError && connection.status === "ERROR" && (
						<p className="mt-1 text-xs text-destructive">{connection.lastError}</p>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<Button
						variant="outline"
						size="sm"
						onClick={handleSync}
						disabled={isPending || connection.status === "CREATED"}
						className="gap-1.5"
					>
						{isPending && action === "sync" && <Spinner />}
						{isPending && action === "sync" ? "Syncing…" : "Sync now"}
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-10 text-muted-foreground hover:text-foreground md:size-8"
								aria-label={`More for ${connection.displayName}`}
							>
								<HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-52">
							<DropdownMenuItem
								disabled={connection.status === "CREATED"}
								onClick={() => setConfirming("reset")}
							>
								<HugeiconsIcon icon={RefreshIcon} className="mr-2 size-4" />
								Import again from scratch…
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => setConfirming("delete")}
							>
								<HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
								Disconnect…
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{connection.bankAccounts.length > 0 && (
				<div className="mt-3 divide-y divide-rule border-t border-rule">
					{connection.bankAccounts.map((ba) => (
						<div
							key={ba.id}
							className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
						>
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
								<SelectTrigger
									className="w-full sm:w-48"
									aria-label={`Kuroji account for ${ba.name}`}
								>
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

			<ConfirmDelete
				open={confirming === "reset"}
				onOpenChange={(open) => !open && setConfirming(null)}
				title={`Import ${connection.displayName} again?`}
				description="Its linked accounts lose every transaction and get them again from the bank. Other accounts are untouched."
				confirmLabel="Delete and import"
				onConfirm={handleReset}
			/>
			<ConfirmDelete
				open={confirming === "delete"}
				onOpenChange={(open) => !open && setConfirming(null)}
				title={`Disconnect ${connection.displayName}?`}
				description="Imports stop. The transactions already imported stay."
				confirmLabel="Disconnect"
				onConfirm={handleDelete}
			/>
		</div>
	);
}

/** The bank connections section's action: pick a Polish bank, then authorize at the bank. */
export function ConnectBankButton({ workspaceId }: { workspaceId: string }) {
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
				<Button variant="outline">Connect Bank</Button>
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
								className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface disabled:opacity-50"
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
