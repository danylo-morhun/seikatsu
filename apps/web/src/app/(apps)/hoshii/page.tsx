import { getChromeData, getHoshii } from "@/features/hoshii/actions/data";
import { NowView } from "@/features/hoshii/components/NowView";
import { HoshiiWelcome } from "@/features/hoshii/components/Welcome";
import { getCurrentWorkspace } from "@/lib/session";
import { getUserToday } from "@/lib/timezone";
import { redirect } from "next/navigation";

export default async function HoshiiPage() {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const today = await getUserToday();
	const [data, chrome] = await Promise.all([
		getHoshii(workspace, today),
		getChromeData(workspace, today),
	]);

	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
			{data.items.length === 0 ? (
				<HoshiiWelcome hasPiggy={data.piggy != null} />
			) : (
				<NowView
					data={{
						queue: data.queue,
						piggy: data.piggy,
						budget: data.budget,
						currency: data.currency,
						items: data.items,
					}}
					chrome={chrome}
					today={today}
				/>
			)}
		</div>
	);
}
