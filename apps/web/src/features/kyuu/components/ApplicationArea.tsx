"use client";

import { ContextArea, openContextMenu } from "@/components/ContextArea";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Archive01Icon,
	ArchiveArrowUpIcon,
	Calendar03Icon,
	Cancel01Icon,
	Delete01Icon,
	LinkSquare02Icon,
	Mail01Icon,
	SentIcon,
	SidebarRightIcon,
	UserMultipleIcon,
	ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ContextMenuItem,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
} from "@seikatsu/ui";
import { useRouter } from "next/navigation";
import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useOptimistic,
	useRef,
	useState,
	useTransition,
} from "react";
import { toast } from "sonner";
import { followUp, ghostApplications, setArchived, setStatus } from "../actions/progress";
import { requestDeleteApplication } from "../lib/events";
import { STATUSES, STATUS_CONFIG, type Status } from "../lib/stages";
import type { ApplicationRow } from "../lib/types";
import { StatusMark } from "./StatusMark";

const FAILED = { error: "Couldn't save. Check your connection." } as const;

type Patch = { id: string; changes: Partial<ApplicationRow> & { hidden?: boolean } };
type Shown = ApplicationRow & { hidden?: boolean };

interface AreaValue {
	/** The row with any change still on its way to the server. */
	shown: (row: ApplicationRow) => Shown;
	actions: RowActions;
}

export interface RowActions {
	setStatus: (id: string, status: Status) => void;
	followUp: (id: string) => void;
	ghost: (ids: string[]) => void;
	archive: (id: string, archived: boolean) => void;
}

const AreaContext = createContext<AreaValue | null>(null);

export function useApplicationArea(): AreaValue {
	const value = useContext(AreaContext);
	if (!value) throw new Error("useApplicationArea outside ApplicationArea");
	return value;
}

/** The row the keys act on: the one in focus, else the one under the pointer. */
function targetRow(): HTMLElement | null {
	const focused = document.activeElement;
	if (focused instanceof HTMLElement) {
		const row = focused.closest<HTMLElement>("[data-app-row]");
		const button = row?.querySelector<HTMLElement>("[data-app-id]");
		if (button) return button;
	}
	const hovered = document.querySelector<HTMLElement>("[data-app-row]:hover");
	return hovered?.querySelector<HTMLElement>("[data-app-id]") ?? null;
}

function neighbourRow(from: HTMLElement, down: boolean): HTMLElement | null {
	const all = [...document.querySelectorAll<HTMLElement>("[data-app-id]")];
	const i = all.indexOf(from);
	return i < 0 ? null : (all[i + (down ? 1 : -1)] ?? null);
}

/**
 * Around a page's lists of applications: one right-click menu, the row keys, and changes
 * shown at once while the server catches up. Rows read it through useApplicationArea.
 */
export function ApplicationArea({
	rows,
	children,
}: {
	/** Every row on the page, for the menu and the keys. */
	rows: ApplicationRow[];
	children: React.ReactNode;
}) {
	const [, startTransition] = useTransition();
	const [patches, applyPatch] = useOptimistic<Record<string, Patch["changes"]>, Patch>(
		{},
		(state, p) => ({ ...state, [p.id]: { ...state[p.id], ...p.changes } }),
	);
	const [menuId, setMenuId] = useState<string | null>(null);
	const router = useRouter();
	const go = (href: string) => {
		startNavigationProgress();
		router.push(href);
	};

	const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

	function run(
		patch: Patch | Patch[],
		action: () => Promise<{ error: string } | { success: true }>,
	) {
		startTransition(async () => {
			for (const p of Array.isArray(patch) ? patch : [patch]) applyPatch(p);
			const result = await action().catch(() => FAILED);
			if ("error" in result) toast.error(result.error);
		});
	}

	const actions: RowActions = {
		setStatus: (id, status) =>
			run({ id, changes: { status, waiting: null } }, () => setStatus(id, status)),
		followUp: (id) =>
			run({ id, changes: { waiting: null } }, async () => {
				const result = await followUp(id);
				if ("success" in result) toast("Follow-up logged: the clock restarts");
				return result;
			}),
		ghost: (ids) =>
			run(
				ids.map((id) => ({ id, changes: { status: "ghosted" as const, waiting: null } })),
				async () => {
					const result = await ghostApplications(ids);
					if ("success" in result && ids.length > 1)
						toast(`${result.data.count} closed as ghosted`);
					return result;
				},
			),
		archive: (id, archived) =>
			run({ id, changes: { hidden: true } }, async () => {
				const result = await setArchived(id, archived);
				const row = byId.get(id);
				if ("success" in result && row)
					toast(archived ? `“${row.company}” archived` : `“${row.company}” restored`, {
						action: {
							label: "Undo",
							onClick: () =>
								void setArchived(id, !archived).then((r) => "error" in r && toast.error(r.error)),
						},
					});
				return result;
			}),
	};

	const shown = (row: ApplicationRow): Shown => {
		const p = patches[row.id];
		return p ? { ...row, ...p } : row;
	};

	// ── Keys: on the row in focus or under the pointer ──
	const keyRef = useRef<(key: string) => boolean>(() => false);
	keyRef.current = (key) => {
		const el = targetRow();
		const id = el?.dataset.appId;
		const base = id ? byId.get(id) : undefined;
		if (!el || !id || !base) return false;
		const row = shown(base);
		if (key === "o") {
			if (!row.jobUrl) return false;
			window.open(row.jobUrl, "_blank", "noopener,noreferrer");
		} else if (key === "x" && (row.status === "drafted" || row.status === "sourced"))
			actions.setStatus(id, "applied");
		else if (key === "s") go(`/kyuu/${id}?log=screening`);
		else if (key === "i") go(`/kyuu/${id}?log=interview`);
		else if (key === "r") actions.setStatus(id, "rejected");
		else if (key === "g" && row.status === "applied") actions.ghost([id]);
		else if (key === "f" && row.status === "applied") actions.followUp(id);
		else if (key === "a") actions.archive(id, !row.archived);
		else if (key === ".") openContextMenu(el);
		else if (key === "delete") requestDeleteApplication({ id, company: row.company });
		else return false;
		return true;
	};
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k && keyRef.current(k)) {
				e.preventDefault();
				return;
			}
			if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
			if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
			if (!(e.target instanceof HTMLElement) || !e.target.closest("[data-app-row]")) return;
			const from = targetRow();
			const next = from && neighbourRow(from, e.key === "ArrowDown");
			if (next) {
				e.preventDefault();
				next.focus();
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const menuBase = menuId ? byId.get(menuId) : undefined;
	const menuRow = menuBase ? shown(menuBase) : undefined;

	return (
		<AreaContext.Provider value={{ shown, actions }}>
			<ContextArea
				attr="data-app-id"
				onTarget={(id) => {
					setMenuId(id);
					return byId.has(id);
				}}
				onClose={() => setMenuId(null)}
				menu={menuRow && <RowMenu row={menuRow} actions={actions} go={go} />}
			>
				{children}
			</ContextArea>
		</AreaContext.Provider>
	);
}

/** A row's right-click menu (and its ⋯ and "." key): every row action, keys named beside. */
function RowMenu({
	row,
	actions,
	go,
}: {
	row: Shown;
	actions: RowActions;
	go: (href: string) => void;
}) {
	const id = row.id;
	const unsent = row.status === "drafted" || row.status === "sourced";
	return (
		<>
			<ContextMenuItem onSelect={() => go(`/kyuu/${id}`)}>
				<HugeiconsIcon icon={SidebarRightIcon} />
				Open
				<ContextMenuShortcut>↵</ContextMenuShortcut>
			</ContextMenuItem>
			{row.jobUrl && (
				<ContextMenuItem asChild>
					<a href={row.jobUrl} target="_blank" rel="noopener noreferrer">
						<HugeiconsIcon icon={LinkSquare02Icon} />
						Open the posting
						<ContextMenuShortcut>O</ContextMenuShortcut>
					</a>
				</ContextMenuItem>
			)}
			<ContextMenuSeparator />
			{unsent && (
				<ContextMenuItem onSelect={() => actions.setStatus(id, "applied")}>
					<HugeiconsIcon icon={SentIcon} />
					Mark sent
					<ContextMenuShortcut>X</ContextMenuShortcut>
				</ContextMenuItem>
			)}
			<ContextMenuItem onSelect={() => go(`/kyuu/${id}?log=screening`)}>
				<HugeiconsIcon icon={UserMultipleIcon} />
				Book a screening…
				<ContextMenuShortcut>S</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => go(`/kyuu/${id}?log=interview`)}>
				<HugeiconsIcon icon={Calendar03Icon} />
				Book an interview…
				<ContextMenuShortcut>I</ContextMenuShortcut>
			</ContextMenuItem>
			{row.status === "applied" && (
				<>
					<ContextMenuItem onSelect={() => actions.followUp(id)}>
						<HugeiconsIcon icon={Mail01Icon} />
						Followed up
						<ContextMenuShortcut>F</ContextMenuShortcut>
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => actions.ghost([id])}>
						<HugeiconsIcon icon={ViewOffSlashIcon} />
						No answer, close
						<ContextMenuShortcut>G</ContextMenuShortcut>
					</ContextMenuItem>
				</>
			)}
			<ContextMenuItem onSelect={() => actions.setStatus(id, "rejected")}>
				<HugeiconsIcon icon={Cancel01Icon} />
				Rejected
				<ContextMenuShortcut>R</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuSub>
				<ContextMenuSubTrigger inset>Status</ContextMenuSubTrigger>
				<ContextMenuSubContent className="w-44">
					<ContextMenuRadioGroup
						value={row.status}
						onValueChange={(v) => actions.setStatus(id, v as Status)}
					>
						{STATUSES.map((s) => (
							<ContextMenuRadioItem key={s} value={s} aria-label={STATUS_CONFIG[s].label}>
								<StatusMark status={s} />
							</ContextMenuRadioItem>
						))}
					</ContextMenuRadioGroup>
				</ContextMenuSubContent>
			</ContextMenuSub>
			<ContextMenuSeparator />
			<ContextMenuItem onSelect={() => actions.archive(id, !row.archived)}>
				<HugeiconsIcon icon={row.archived ? ArchiveArrowUpIcon : Archive01Icon} />
				{row.archived ? "Restore" : "Archive"}
				<ContextMenuShortcut>A</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				className="text-destructive focus:text-destructive"
				onSelect={() => requestDeleteApplication({ id, company: row.company })}
			>
				<HugeiconsIcon icon={Delete01Icon} />
				Delete…
				<ContextMenuShortcut>⌫</ContextMenuShortcut>
			</ContextMenuItem>
		</>
	);
}
