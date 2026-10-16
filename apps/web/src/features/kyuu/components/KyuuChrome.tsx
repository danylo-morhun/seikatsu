"use client";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Add01Icon,
	ChartLineData01Icon,
	Settings01Icon,
	Task01Icon,
	TaskDone01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	createApplication,
	deleteApplication,
	getApplication,
	patchApplication,
	updateApplication,
} from "../actions/applications";
import { deleteEvent, logEvent, setArchived, setStatus, updateEvent } from "../actions/progress";
import {
	DELETE_APPLICATION_EVENT,
	EDIT_APPLICATION_EVENT,
	LOG_EVENT_EVENT,
	NEW_APPLICATION_EVENT,
	OPEN_APPLICATION_EVENT,
	requestNewApplication,
} from "../lib/events";
import { localToday } from "../lib/format";
import type { EventKind, Status } from "../lib/stages";
import type { ApplicationDetail, ResumeFile } from "../lib/types";
import { ApplicationDialog } from "./ApplicationDialog";
import { ApplicationSheet } from "./ApplicationSheet";
import { EventDialog, type EventTarget } from "./EventDialog";

const FAILED = { error: "Couldn't save. Check your connection." } as const;

type IdEvent = CustomEvent<{ id: string; kind?: EventKind }>;

async function load(id: string): Promise<ApplicationDetail | null> {
	const result = await getApplication(id).catch(() => FAILED);
	if ("error" in result) {
		toast.error(result.error);
		return null;
	}
	return result.data;
}

/**
 * Kyuu's chrome around every page: the phone's bottom pill, the app-wide keys, and the one
 * application sheet and the dialogs (new, edit, event, delete) that every list opens.
 */
export function KyuuChrome({
	sources,
	resumeFiles,
}: { sources: string[]; resumeFiles: ResumeFile[] }) {
	const pathname = usePathname();
	const router = useRouter();
	const today = localToday();

	const [capture, setCapture] = useState({ open: false, instant: false });
	const [sheet, setSheet] = useState<{ id: string; detail: ApplicationDetail | null } | null>(null);
	const [editing, setEditing] = useState<{ detail: ApplicationDetail; instant: boolean } | null>(
		null,
	);
	const [eventTarget, setEventTarget] = useState<{
		target: EventTarget;
		applicationId: string;
		instant: boolean;
	} | null>(null);
	const [deleting, setDeleting] = useState<ApplicationDetail | null>(null);

	// The sheet's application, read fresh after every change made through it.
	const sheetRef = useRef(sheet);
	sheetRef.current = sheet;
	const refresh = useCallback(async (id: string) => {
		const detail = await load(id);
		if (detail && sheetRef.current?.id === id) setSheet({ id, detail });
	}, []);

	const open = useCallback(async (id: string) => {
		setSheet({ id, detail: null });
		const detail = await load(id);
		if (!detail) setSheet(null);
		else if (sheetRef.current?.id === id) setSheet({ id, detail });
	}, []);

	const detailFor = useCallback(async (id: string) => {
		const current = sheetRef.current;
		return current?.id === id && current.detail ? current.detail : load(id);
	}, []);

	// ── Requests from the lists, the header and the keys ──
	useEffect(() => {
		function go(href: string) {
			startNavigationProgress();
			router.push(href);
		}
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k === "n") setCapture({ open: true, instant: true });
			else if (k === "1") go("/kyuu");
			else if (k === "2") go("/kyuu/all");
			else if (k === "3") go("/kyuu/stats");
			else if (k === ",") go("/settings/kyuu");
			else return;
			e.preventDefault();
		}
		const onNew = () => setCapture({ open: true, instant: false });
		const onOpen = (e: Event) => void open((e as IdEvent).detail.id);
		const onEdit = async (e: Event) => {
			const detail = await detailFor((e as IdEvent).detail.id);
			if (detail) setEditing({ detail, instant: true });
		};
		const onLog = async (e: Event) => {
			const { id, kind } = (e as IdEvent).detail;
			const detail = await detailFor(id);
			if (detail)
				setEventTarget({
					applicationId: id,
					instant: false,
					target: { mode: "new", company: detail.company, kind: kind ?? "screening" },
				});
		};
		const onDelete = async (e: Event) => {
			const detail = await detailFor((e as IdEvent).detail.id);
			if (detail) setDeleting(detail);
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener(NEW_APPLICATION_EVENT, onNew);
		window.addEventListener(OPEN_APPLICATION_EVENT, onOpen);
		window.addEventListener(EDIT_APPLICATION_EVENT, onEdit);
		window.addEventListener(LOG_EVENT_EVENT, onLog);
		window.addEventListener(DELETE_APPLICATION_EVENT, onDelete);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener(NEW_APPLICATION_EVENT, onNew);
			window.removeEventListener(OPEN_APPLICATION_EVENT, onOpen);
			window.removeEventListener(EDIT_APPLICATION_EVENT, onEdit);
			window.removeEventListener(LOG_EVENT_EVENT, onLog);
			window.removeEventListener(DELETE_APPLICATION_EVENT, onDelete);
		};
	}, [router, open, detailFor]);

	// ── The sheet's actions ──
	const shown = sheet?.detail ?? null;

	async function run(id: string, action: () => Promise<{ error: string } | { success: true }>) {
		const result = await action().catch(() => FAILED);
		if ("error" in result) toast.error(result.error);
		await refresh(id);
		return "error" in result ? result.error : undefined;
	}

	function changeStatus(status: Status) {
		if (!shown) return;
		// The sheet moves at once; the server confirms.
		setSheet({ id: shown.id, detail: { ...shown, status } });
		void run(shown.id, () => setStatus(shown.id, status));
	}

	const nav = (href: string, label: string, icon: typeof Add01Icon, active: boolean) => (
		<Link
			href={href}
			prefetch
			aria-current={active ? "page" : undefined}
			className={cn(
				"relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
				active ? "text-primary" : "text-muted-foreground active:text-foreground",
			)}
		>
			<span className="flex h-7 w-12 items-center justify-center">
				<HugeiconsIcon icon={icon} className="h-5 w-5" />
			</span>
			<span className="max-w-full truncate px-0.5 text-[11px] font-medium leading-none">
				{label}
			</span>
		</Link>
	);
	const isAll = pathname === "/kyuu/all";
	const isStats = pathname === "/kyuu/stats";
	const isSettings = pathname.startsWith("/settings/kyuu");
	const isNow = pathname === "/kyuu";
	// Grid column of the lit item (the add button holds column 2).
	const litColumn = isNow ? 0 : isAll ? 1 : isStats ? 3 : isSettings ? 4 : -1;

	return (
		<>
			<nav
				aria-label="Kyuu sections"
				className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				<div className="relative mx-3 mb-3 grid grid-cols-5 items-center rounded-2xl border border-rule bg-sidebar px-1 py-1.5">
					{litColumn >= 0 && (
						<span
							aria-hidden
							className="pointer-events-none absolute top-1.5 left-1 flex w-[calc((100%-0.5rem)/5)] justify-center transition-transform duration-300 ease-in-out motion-reduce:transition-none"
							style={{ transform: `translateX(${litColumn * 100}%)` }}
						>
							<span className="h-7 w-12 rounded-full bg-primary/15" />
						</span>
					)}
					{nav("/kyuu", "Now", Task01Icon, isNow)}
					{nav("/kyuu/all", "All", TaskDone01Icon, isAll)}
					<div className="flex items-center justify-center">
						<Button
							size="icon"
							aria-label="New application"
							className="h-11 w-11 rounded-full"
							onClick={requestNewApplication}
						>
							<HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
						</Button>
					</div>
					{nav("/kyuu/stats", "Stats", ChartLineData01Icon, isStats)}
					{nav("/settings/kyuu", "Settings", Settings01Icon, isSettings)}
				</div>
			</nav>

			<ApplicationSheet
				application={shown}
				open={sheet != null}
				onOpenChange={(v) => !v && setSheet(null)}
				today={today}
				actions={{
					setStatus: changeStatus,
					edit: () => shown && setEditing({ detail: shown, instant: false }),
					logEvent: (kind) =>
						shown &&
						setEventTarget({
							applicationId: shown.id,
							instant: false,
							target: { mode: "new", company: shown.company, kind },
						}),
					editEvent: (event) =>
						shown &&
						setEventTarget({
							applicationId: shown.id,
							instant: false,
							target: { mode: "edit", company: shown.company, event },
						}),
					patch: (patch) => shown && void run(shown.id, () => patchApplication(shown.id, patch)),
					setArchived: (archived) => {
						if (!shown) return;
						void run(shown.id, () => setArchived(shown.id, archived)).then((error) => {
							if (!error)
								toast(archived ? `“${shown.company}” archived` : `“${shown.company}” restored`);
						});
					},
					delete: () => shown && setDeleting(shown),
				}}
			/>

			<ApplicationDialog
				application={null}
				open={capture.open}
				instant={capture.instant}
				onOpenChange={(v) => setCapture((c) => ({ ...c, open: v }))}
				sources={sources}
				resumeFiles={resumeFiles}
				onSave={async (values) => {
					const result = await createApplication(values).catch(() => FAILED);
					if ("error" in result) return result.error;
					toast.success(`“${values.company}” added`, {
						action: { label: "Open", onClick: () => void open(result.data.id) },
					});
					return undefined;
				}}
			/>

			<ApplicationDialog
				application={editing?.detail ?? null}
				open={editing != null}
				instant={editing?.instant}
				onOpenChange={(v) => !v && setEditing(null)}
				sources={sources}
				resumeFiles={resumeFiles}
				onSave={async (values) => {
					if (!editing) return;
					const id = editing.detail.id;
					const result = await updateApplication(id, values).catch(() => FAILED);
					if ("error" in result) return result.error;
					await refresh(id);
					return undefined;
				}}
			/>

			<EventDialog
				target={eventTarget?.target ?? null}
				instant={eventTarget?.instant}
				onOpenChange={(v) => !v && setEventTarget(null)}
				onSave={async (input) => {
					if (!eventTarget) return;
					const { target, applicationId } = eventTarget;
					const result = await (target.mode === "new"
						? logEvent(applicationId, input)
						: updateEvent(target.event.id, input)
					).catch(() => FAILED);
					if ("error" in result) return result.error;
					await refresh(applicationId);
					return undefined;
				}}
				onDelete={async () => {
					if (eventTarget?.target.mode !== "edit") return;
					const { applicationId, target } = eventTarget;
					const result = await deleteEvent(target.event.id).catch(() => FAILED);
					if ("error" in result) return result.error;
					await refresh(applicationId);
					return undefined;
				}}
			/>

			<ConfirmDelete
				open={deleting != null}
				onOpenChange={(v) => !v && setDeleting(null)}
				title={`Delete “${deleting?.company ?? ""}”?`}
				description={
					deleting && deleting.events.length > 0
						? "Its timeline and notes go with it. Archive it instead to keep them. This can't be undone."
						: "Archive it instead to keep it out of the way. This can't be undone."
				}
				onConfirm={async () => {
					if (!deleting) return;
					const result = await deleteApplication(deleting.id).catch(() => FAILED);
					if ("error" in result) toast.error(result.error);
					else if (sheetRef.current?.id === deleting.id) setSheet(null);
				}}
			/>
		</>
	);
}
