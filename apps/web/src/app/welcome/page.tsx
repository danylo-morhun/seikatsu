import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { WelcomeFlow } from "@/features/welcome/components/WelcomeFlow";
import { canSetCurrency, hasNoBoards } from "@/features/welcome/lib/data";
import { startingChoice } from "@/features/welcome/lib/welcome";
import { getCurrentWorkspace } from "@/lib/session";

/** First-run setup, without the shell: a new user lands here from Today until it's done.
 * `?again` sets up again from Settings → Apps. */
export default async function WelcomePage({
	searchParams,
}: {
	searchParams: Promise<{ again?: string }>;
}) {
	const session = await auth();
	if (!session) redirect("/");
	const [workspace, { again }] = await Promise.all([getCurrentWorkspace(), searchParams]);
	if (!workspace) redirect("/");
	const setup = again !== undefined;
	if (workspace.onboardedAt && !setup) redirect("/");

	return (
		<main className="min-h-screen">
			<WelcomeFlow
				firstName={session.user?.name?.split(" ")[0] ?? null}
				again={setup}
				start={startingChoice(workspace.onboardedAt ? workspace.modulesOff : null)}
				currency={workspace.baseCurrency}
				canSetCurrency={await canSetCurrency(workspace.id)}
				noBoards={await hasNoBoards(workspace.id)}
			/>
		</main>
	);
}
