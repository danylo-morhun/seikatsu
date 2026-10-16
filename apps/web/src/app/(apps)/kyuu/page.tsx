import { getNow } from "@/features/kyuu/actions/applications";
import { NowView } from "@/features/kyuu/components/NowView";
import { getUserToday } from "@/lib/timezone";

export default async function KyuuPage() {
	const [data, today] = await Promise.all([getNow(), getUserToday()]);
	return (
		<div className="px-4 pt-6 pb-28 sm:px-8 md:py-8">
			<NowView data={data} today={today} />
		</div>
	);
}
