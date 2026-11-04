"use client";

import {
	ArrowUpDownIcon,
	Calendar03Icon,
	DashboardSquare01Icon,
	Home01Icon,
	KeyboardIcon,
	Logout01Icon,
	Target02Icon,
	UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Avatar,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
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
import { useDesign } from "@/components/DesignProvider";
import { signOutAction } from "@/features/auth/actions/auth";
import { APPS_CONFIG } from "@/lib/app-themes";
import { SHORTCUTS_EVENT } from "@/lib/shortcuts";

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

const isApp = (pathname: string) =>
	pathname === "/apps" ||
	Object.keys(APPS_CONFIG).some((href) => pathname === href || pathname.startsWith(`${href}/`));

/** The shell's places, in the order of the phone's bar. Apps is lit inside any app. */
export const SHELL = [
	{ href: "/", label: "Today", icon: Home01Icon, match: (p: string) => p === "/" },
	{ href: "/week", label: "Week", icon: Calendar03Icon, match: (p: string) => p === "/week" },
	{ href: "/goals", label: "Goals", icon: Target02Icon, match: (p: string) => p === "/goals" },
	{ href: "/apps", label: "Apps", icon: DashboardSquare01Icon, match: isApp },
] as const;

export function AppSidebar({ workspaceName, user }: Props) {
	const pathname = usePathname();
	const { design } = useDesign();

	return (
		// Liquid Glass: a floating glass panel; Classic: the lacquer shell around an inset tray.
		<Sidebar collapsible="icon" variant={design === "glass" ? "floating" : "inset"}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						{/* The mark opens Today, the home: every app's state on one page. */}
						<SidebarMenuButton
							asChild
							size="lg"
							tooltip="seikatsu"
							className="data-active:bg-sidebar-accent"
						>
							<Link href="/" prefetch aria-label="seikatsu">
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
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						{/* The shell's four places. The apps open from Apps (or Today's rows, or ⌘K);
						    inside one, the header's switcher moves between them. */}
						<SidebarMenu>
							{SHELL.map(({ href, label, icon, match }) => (
								<SidebarMenuItem key={href}>
									<SidebarMenuButton
										asChild
										isActive={match(pathname)}
										tooltip={label}
										className="h-10 gap-2.5 data-active:bg-sidebar-accent data-active:font-semibold"
									>
										<Link href={href} prefetch>
											<HugeiconsIcon icon={icon} className="size-[18px]" />
											<span className="truncate text-sm font-medium">{label}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
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
								{/* Phones have no keyboard to speak of. */}
								<DropdownMenuItem
									className="max-md:hidden"
									onSelect={() => window.dispatchEvent(new CustomEvent(SHORTCUTS_EVENT))}
								>
									<HugeiconsIcon icon={KeyboardIcon} className="h-4 w-4" />
									Keyboard shortcuts
									<DropdownMenuShortcut>?</DropdownMenuShortcut>
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
