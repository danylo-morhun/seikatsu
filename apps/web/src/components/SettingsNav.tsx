"use client";

import { UnderlineTab, UnderlineTabs } from "@/components/UnderlineTabs";
import { APPS_CONFIG } from "@/lib/app-themes";
import { usePathname } from "next/navigation";

// Only apps that have a settings page (app/(apps)/settings/<app>); others would 404.
const APPS_WITH_SETTINGS = new Set(["/kuroji"]);

/** Settings is one column: the account and each app are tabs across the top. */
export function SettingsNav() {
	const pathname = usePathname();

	const links = [
		{ href: "/settings/account", label: "Account" },
		...Object.entries(APPS_CONFIG)
			.filter(([appHref]) => APPS_WITH_SETTINGS.has(appHref))
			.map(([appHref, { name }]) => ({ href: `/settings${appHref}`, label: name })),
	];

	return (
		<div className="max-w-3xl px-4 pt-2 sm:px-8 md:pt-4">
			<UnderlineTabs label="Settings">
				{links.map(({ href, label }) => (
					<UnderlineTab key={href} href={href} current={pathname === href}>
						{label}
					</UnderlineTab>
				))}
			</UnderlineTabs>
		</div>
	);
}
