"use client";

import { signOutAction } from "@/features/auth/actions/auth";
import { readAppEntry } from "@/lib/app-entry";
import { APPS_CONFIG } from "@/lib/app-themes";
import { ArrowUpDownIcon, Logout01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Avatar,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	cn,
} from "@seikatsu/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface User {
	id: string;
	name?: string | null;
	email?: string | null;
	image?: string | null;
}

interface Props {
	workspaceName: string;
	user?: User | null;
}

export function AppSidebar({ workspaceName, user }: Props) {
	const pathname = usePathname();
	const [entryHrefs, setEntryHrefs] = useState<Record<string, string>>({});

	// Re-read on every navigation so the link follows the last project/page visited.
	useEffect(() => {
		const next: Record<string, string> = {};
		for (const href of Object.keys(APPS_CONFIG)) {
			const entry = readAppEntry(href);
			if (entry) next[href] = entry;
		}
		setEntryHrefs(next);
	}, [pathname]);

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" className="cursor-default">
							{/* A bare ink mark, so the shell's logo never reads as one of the app tiles. */}
							<div className="flex size-8 shrink-0 items-center justify-center">
								<span className="text-[24px] font-bold leading-none text-sidebar-foreground">
									生
								</span>
							</div>
							<div className="flex min-w-0 flex-col text-left leading-none">
								<span className="text-sm font-bold">seikatsu</span>
								<span className="truncate text-xs text-muted-foreground">{workspaceName}</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{Object.entries(APPS_CONFIG).map(([href, { name, label, kanji, theme }]) => {
								const isActive = pathname.startsWith(href);
								return (
									<SidebarMenuItem key={href}>
										<SidebarMenuButton
											asChild
											isActive={isActive}
											tooltip={`${name} · ${label}`}
											// The active app is lit from inside with its own pigment.
											className="h-11 gap-2.5 p-1.5 group-data-[collapsible=icon]:p-1! data-active:bg-primary/15 data-active:hover:bg-primary/20"
										>
											<Link href={entryHrefs[href] ?? href} prefetch>
												{/* The kanji is the app's mark, tinted with its own pigment. */}
												<span
													aria-hidden
													className={cn(
														theme,
														"flex size-8 shrink-0 items-center justify-center rounded-md text-[15px] font-semibold leading-none transition-colors group-data-[collapsible=icon]:size-6 group-data-[collapsible=icon]:text-[13px]",
														isActive
															? "bg-primary text-primary-foreground"
															: "bg-primary/10 text-primary",
													)}
												>
													{kanji}
												</span>
												<span className="flex min-w-0 flex-col leading-tight">
													<span className="truncate text-sm font-medium">{name}</span>
													<span className="truncate text-xs text-muted-foreground">{label}</span>
												</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<Avatar src={user?.image} name={user?.name} size="sm" />
									<div className="flex min-w-0 flex-col text-left leading-none">
										<span className="truncate text-sm font-medium">{user?.name ?? "User"}</span>
										<span className="truncate text-xs text-muted-foreground">
											{user?.email ?? ""}
										</span>
									</div>
									<HugeiconsIcon
										icon={ArrowUpDownIcon}
										className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/60"
									/>
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-[var(--radix-dropdown-menu-trigger-width)]"
								side="top"
								align="start"
								sideOffset={8}
							>
								<DropdownMenuLabel className="flex items-center gap-2">
									<Avatar src={user?.image} name={user?.name} size="sm" />
									<div className="flex min-w-0 flex-col leading-none">
										<span className="truncate font-medium">{user?.name ?? "User"}</span>
										<span className="truncate text-xs font-normal text-muted-foreground">
											{user?.email ?? ""}
										</span>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link href="/settings">
										<HugeiconsIcon icon={UserCircleIcon} className="h-4 w-4" />
										Account settings
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<form action={signOutAction} className="w-full">
										<button
											type="submit"
											className="flex w-full items-center gap-2 text-destructive"
										>
											<HugeiconsIcon icon={Logout01Icon} className="h-4 w-4" />
											Sign out
										</button>
									</form>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
