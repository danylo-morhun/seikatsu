import { redirect } from "next/navigation";

// v2 kept the table here; it's Kyuu's home now. Old links keep their view and filters.
export default async function KyuuAllPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(await searchParams))
		if (typeof value === "string") params.set(key, value);
	const qs = params.toString();
	redirect(qs ? `/kyuu?${qs}` : "/kyuu");
}
