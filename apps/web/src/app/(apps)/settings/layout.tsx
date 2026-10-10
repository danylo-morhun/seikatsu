import { SettingsNav } from "@/components/SettingsNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="h-full overflow-y-auto">
			<SettingsNav />
			{children}
		</div>
	);
}
