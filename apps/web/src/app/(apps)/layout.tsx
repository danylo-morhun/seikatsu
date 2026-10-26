import { AppFrame } from "@/components/AppFrame";

export default function AppsLayout({ children }: { children: React.ReactNode }) {
	return <AppFrame>{children}</AppFrame>;
}
