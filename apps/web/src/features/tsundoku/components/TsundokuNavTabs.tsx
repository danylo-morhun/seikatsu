"use client";

import { PageLoader } from "@/components/PageLoader";
import { AddBookModal } from "@/features/tsundoku/components/AddBookModal";
import { Add01Icon, Book01Icon, Chart01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

const TABS = [
	{ href: "/tsundoku", label: "Library", icon: Book01Icon, exact: true },
	{ href: "/tsundoku/stats", label: "Stats", icon: Chart01Icon, exact: false },
] as const;

export function TsundokuNavTabs({ workspaceId }: { workspaceId: string }) {
	const pathname = usePathname();
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	function isActive(href: string, exact: boolean) {
		return exact ? pathname === href : pathname.startsWith(href);
	}

	function nav(href: string) {
		if (pathname === href) return;
		startTransition(() => router.push(href));
	}

	return (
		<>
			{isPending && <PageLoader overlay />}

			{/* Desktop tab nav */}
			<div className="hidden border-b border-border/60 md:block">
				<div className="flex items-center gap-1 px-4 sm:px-6">
					{TABS.map(({ href, label, icon, exact }) => (
						<Link
							key={href}
							href={href}
							className={cn(
								"flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
								isActive(href, exact)
									? "border-primary text-primary"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)}
						>
							<HugeiconsIcon icon={icon} className="h-4 w-4" />
							{label}
						</Link>
					))}
				</div>
			</div>

			{/* Mobile bottom nav + FAB */}
			<nav
				className="fixed inset-x-0 bottom-0 z-40 md:hidden"
				style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
			>
				<div className="mx-3 mb-3">
					<div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/85 px-2 py-1.5 shadow-lg backdrop-blur-xl">
						<button
							type="button"
							onClick={() => nav("/tsundoku")}
							className={cn(
								"flex flex-1 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5",
								isActive("/tsundoku", true) ? "text-primary" : "text-muted-foreground",
							)}
						>
							<HugeiconsIcon icon={Book01Icon} className="h-5 w-5" />
							<span className="text-[10px] font-medium leading-none">Library</span>
						</button>

						<div className="flex shrink-0 items-center justify-center px-1">
							<AddBookModal
								workspaceId={workspaceId}
								trigger={
									<Button
										size="icon"
										className="h-11 w-11 rounded-full shadow-lg shadow-primary/25 transition-transform active:scale-95"
									>
										<HugeiconsIcon icon={Add01Icon} className="h-5 w-5" />
									</Button>
								}
							/>
						</div>

						<button
							type="button"
							onClick={() => nav("/tsundoku/stats")}
							className={cn(
								"flex flex-1 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5",
								isActive("/tsundoku/stats", false) ? "text-primary" : "text-muted-foreground",
							)}
						>
							<HugeiconsIcon icon={Chart01Icon} className="h-5 w-5" />
							<span className="text-[10px] font-medium leading-none">Stats</span>
						</button>
					</div>
				</div>
			</nav>
		</>
	);
}
