"use client";

import { signOutAction } from "@/features/auth/actions/auth";
import { APPS_CONFIG } from "@/lib/app-themes";
import {
	ArrowUpDownIcon,
	Book01Icon,
	KanbanIcon,
	Logout01Icon,
	UserCircleIcon,
	YenSquareIcon,
} from "@hugeicons/core-free-icons";
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
} from "@seikatsu/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

const APP_ICONS: Record<string, typeof YenSquareIcon> = {
	"/kuroji": YenSquareIcon,
	"/seiryu": KanbanIcon,
	"/tsundoku": Book01Icon,
};

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

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" className="cursor-default">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
								<span className="text-base font-bold leading-none">生</span>
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
							{Object.entries(APPS_CONFIG).map(([href, { name }]) => {
								const icon = APP_ICONS[href];
								return (
									<SidebarMenuItem key={href}>
										<SidebarMenuButton asChild isActive={pathname.startsWith(href)} tooltip={name}>
											<Link href={href}>
												{icon && <HugeiconsIcon icon={icon} className="h-4 w-4 shrink-0" />}
												<span>{name}</span>
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
