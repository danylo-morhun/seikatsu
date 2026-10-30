"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { QuietAdd } from "@/components/QuietAdd";
import { SettingsSection } from "@/components/SettingsSection";
import type { AishaDocument, ItemWithDue } from "@/features/aisha/actions/data";
import { deleteDocument } from "@/features/aisha/actions/documents";
import { deleteItem } from "@/features/aisha/actions/items";
import { type AishaVehicle, setKurojiDefaults } from "@/features/aisha/actions/vehicles";
import { DocumentDialog } from "@/features/aisha/components/DocumentDialog";
import { ItemDialog } from "@/features/aisha/components/ItemDialog";
import { VehicleForm } from "@/features/aisha/components/VehicleForm";
import { DOCUMENT_TYPE_LABELS } from "@/features/aisha/lib/constants";
import { formatDate, formatKm, intervalSummary } from "@/features/aisha/lib/format";
import type { FormAccount } from "@/features/kuroji/actions/form-options";
import { AccountPicker } from "@/features/kuroji/components/AccountSelect";
import { Delete01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@seikatsu/ui";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

const FAILED = { error: "Couldn't save. Check your connection." };
const ROW =
	"group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 transition-colors duration-150 hover:bg-surface-2";
const LIST =
	"inset-group rounded-2xl bg-surface px-4 py-2 divide-y divide-rule [&>*:hover]:border-transparent [&>*:has(+*:hover)]:border-transparent";

/** /settings/aisha: the car, its maintenance plan, its paperwork, and where costs go in Kuroji. */
export function SettingsAisha({
	vehicle,
	items,
	documents,
	accounts,
}: {
	vehicle: AishaVehicle;
	items: ItemWithDue[];
	documents: AishaDocument[];
	/** Kuroji's open accounts, for the defaults. */
	accounts: FormAccount[];
}) {
	const [editing, setEditing] = useState<
		| { kind: "item"; item: ItemWithDue | null }
		| { kind: "document"; doc: AishaDocument | null }
		| null
	>(null);
	const [deleting, setDeleting] = useState<
		{ kind: "item"; item: ItemWithDue } | { kind: "document"; doc: AishaDocument } | null
	>(null);

	return (
		<>
			<SettingsSection
				title="Car"
				description="What it is; the plan's defaults were picked from this."
			>
				<VehicleForm workspaceId={vehicle.workspaceId} vehicle={vehicle} />
			</SettingsSection>

			<SettingsSection
				title="Maintenance plan"
				description="Each item is due at its km or its months, whichever comes first. The intervals are cautious defaults; the car's manual wins."
				meta={items.length}
			>
				<ol className={LIST}>
					{items.map((item) => (
						<li key={item.id} className={ROW}>
							<button
								type="button"
								onClick={() => setEditing({ kind: "item", item })}
								className="min-w-0 rounded-sm py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<span className="block truncate text-sm">{item.name}</span>
								<span className="block truncate text-xs text-muted-foreground">
									{intervalSummary(item.intervalKm, item.intervalMonths)}
									{item.lastDone
										? ` · last ${formatDate(item.lastDone.date)} at ${formatKm(item.lastDone.km)}`
										: " · never logged"}
								</span>
							</button>
							<Button
								size="icon"
								variant="ghost"
								aria-label={`Delete ${item.name}`}
								className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
								onClick={() => setDeleting({ kind: "item", item })}
							>
								<HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
							</Button>
						</li>
					))}
				</ol>
				<QuietAdd className="mt-2" onClick={() => setEditing({ kind: "item", item: null })}>
					Add an item
				</QuietAdd>
			</SettingsSection>

			<SettingsSection
				title="Documents"
				description="Insurance, inspection and the like; Aisha reminds you a month before each runs out."
				meta={documents.length || undefined}
			>
				{documents.length === 0 ? (
					<p className="py-4 text-sm text-muted-foreground">
						None yet. Add the insurance and the inspection first.
					</p>
				) : (
					<ol className={LIST}>
						{documents.map((doc) => (
							<li key={doc.id} className={ROW}>
								<button
									type="button"
									onClick={() => setEditing({ kind: "document", doc })}
									className="min-w-0 rounded-sm py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									<span className="block truncate text-sm">{doc.name}</span>
									<span className="block truncate text-xs text-muted-foreground">
										{DOCUMENT_TYPE_LABELS[doc.type]} · until {formatDate(doc.expiresOn)}
									</span>
								</button>
								<Button
									size="icon"
									variant="ghost"
									aria-label={`Delete ${doc.name}`}
									className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
									onClick={() => setDeleting({ kind: "document", doc })}
								>
									<HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
								</Button>
							</li>
						))}
					</ol>
				)}
				<QuietAdd className="mt-2" onClick={() => setEditing({ kind: "document", doc: null })}>
					Add a document
				</QuietAdd>
			</SettingsSection>

			<KurojiDefaults vehicle={vehicle} accounts={accounts} />

			<ItemDialog
				open={editing?.kind === "item"}
				onOpenChange={(open) => !open && setEditing(null)}
				vehicleId={vehicle.id}
				item={editing?.kind === "item" ? editing.item : null}
			/>
			<DocumentDialog
				open={editing?.kind === "document"}
				onOpenChange={(open) => !open && setEditing(null)}
				vehicleId={vehicle.id}
				doc={editing?.kind === "document" ? editing.doc : null}
			/>
			<ConfirmDelete
				open={deleting != null}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={`Delete “${deleting ? (deleting.kind === "item" ? deleting.item.name : deleting.doc.name) : ""}”?`}
				description={
					deleting?.kind === "item"
						? "It leaves the plan and past services no longer list it. The services themselves stay."
						: "Aisha stops reminding you about it."
				}
				onConfirm={async () => {
					if (!deleting) return;
					const result = await (deleting.kind === "item"
						? deleteItem(deleting.item.id)
						: deleteDocument(deleting.doc.id)
					).catch(() => FAILED);
					if ("error" in result) toast.error(result.error);
				}}
			/>
		</>
	);
}

/** Where "Record in Kuroji" posts unless changed in the dialog; the dialog remembers the last. */
function KurojiDefaults({ vehicle, accounts }: { vehicle: AishaVehicle; accounts: FormAccount[] }) {
	const [, startTransition] = useTransition();
	const [saved, setOptimistic] = useOptimistic(
		{ walletId: vehicle.kurojiWalletId ?? "", categoryId: vehicle.kurojiCategoryId ?? "" },
		(s, patch: Partial<{ walletId: string; categoryId: string }>) => ({ ...s, ...patch }),
	);

	function save(patch: Partial<{ walletId: string; categoryId: string }>) {
		const next = { ...saved, ...patch };
		startTransition(async () => {
			setOptimistic(patch);
			const result = await setKurojiDefaults(vehicle.id, {
				walletId: next.walletId || null,
				categoryId: next.categoryId || null,
			}).catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
		});
	}

	return (
		<SettingsSection
			title="Kuroji"
			description="A service's cost can go to Kuroji as an expense: paid from this account, into this category, unless you pick others when logging it."
		>
			<div className="grid max-w-lg gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<p className="text-sm font-medium leading-none">Paid from</p>
					<AccountPicker
						aria-label="Paid from"
						placeholder="Pick an account"
						accounts={accounts.filter((a) => a.type === "ASSET" || a.type === "LIABILITY")}
						value={saved.walletId}
						onValueChange={(walletId) => save({ walletId })}
					/>
				</div>
				<div className="space-y-2">
					<p className="text-sm font-medium leading-none">Category</p>
					<AccountPicker
						aria-label="Expense category"
						placeholder="Pick a category"
						accounts={accounts.filter((a) => a.type === "EXPENSE")}
						value={saved.categoryId}
						onValueChange={(categoryId) => save({ categoryId })}
					/>
				</div>
			</div>
		</SettingsSection>
	);
}
