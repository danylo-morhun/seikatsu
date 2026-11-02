import { redirect } from "next/navigation";
import { getChromeData } from "@/features/aisha/actions/data";
import { AishaChrome } from "@/features/aisha/components/AishaChrome";
import { getCurrentWorkspace } from "@/lib/session";

export default async function AishaLayout({ children }: { children: React.ReactNode }) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const car = await getChromeData();

	return (
		<>
			{children}
			<AishaChrome car={car} />
		</>
	);
}
