import { auth } from "@/auth";
import { KyuuNavTabs } from "@/features/kyuu/components/KyuuNavTabs";
import { redirect } from "next/navigation";

export default async function KyuuLayout({ children }: { children: React.ReactNode }) {
	const session = await auth();
	if (!session?.user?.id) redirect("/");

	return (
		<div className="flex flex-col">
			<KyuuNavTabs />
			{children}
		</div>
	);
}
