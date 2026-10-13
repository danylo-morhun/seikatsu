import { redirect } from "next/navigation";

/** The page was "Stats" before it became the Year; old links land on it. */
export default function TsundokuStatsPage() {
	redirect("/tsundoku/year");
}
