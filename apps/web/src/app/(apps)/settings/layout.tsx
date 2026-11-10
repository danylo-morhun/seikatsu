import { SettingsNav } from "@/components/SettingsNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="h-full overflow-y-auto">
			<SettingsNav />
			{/* The page's entrance (PageEnter) slides up 8px; clip it so the shift never
			    makes the column scrollable for a moment. */}
			<div className="overflow-y-clip">{children}</div>
		</div>
	);
}
