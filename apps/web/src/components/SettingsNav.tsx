"use client";

import { PageTab, PageTabs } from "@/components/PageTabs";
import { APPS_CONFIG } from "@/lib/app-themes";
import { usePathname } from "next/navigation";

// Only apps that have a settings page (app/(apps)/settings/<app>); others would 404.
const APPS_WITH_SETTINGS = new Set([
	"/kuroji",
	"/seiryu",
	"/tsundoku",
	"/keizoku",
	"/kyuu",
	"/aisha",
	"/hoshii",
]);

/** Settings is one column: the account and each app are tabs across the top. */
export function SettingsNav() {
	const pathname = usePathname();

	const links = [
		{ href: "/settings/account", label: "Account" },
		{ href: "/settings/notifications", label: "Notifications" },
		...Object.entries(APPS_CONFIG)
			.filter(([appHref]) => APPS_WITH_SETTINGS.has(appHref))
			.map(([appHref, { name }]) => ({ href: `/settings${appHref}`, label: name })),
	];

	return (
		<div className="max-w-3xl px-4 pt-2 sm:px-8 md:pt-4">
			<PageTabs label="Settings">
				{links.map(({ href, label }) => (
					<PageTab key={href} href={href} current={pathname === href}>
						{label}
					</PageTab>
				))}
			</PageTabs>
		</div>
	);
}
