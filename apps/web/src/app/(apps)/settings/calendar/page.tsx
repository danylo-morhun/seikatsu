import { redirect } from "next/navigation";
import { SettingsPage, SettingsSection } from "@/components/SettingsSection";
import { ConnectGoogle, GoogleAccount } from "@/features/calendar/components/GoogleSettings";
import { readGoogleSettings } from "@/features/calendar/google/settings";
import { getCurrentWorkspace } from "@/lib/session";

const ERRORS: Record<string, string> = {
	state: "The sign-in took too long or came from elsewhere. Try again.",
	denied: "Google wasn't given access to your calendars.",
	offline: "Google didn't allow lasting access. Try again and allow it.",
	scope: "Calendar access wasn't granted. Try again and tick the calendar box.",
	exchange: "Google didn't finish the connection. Try again.",
	config: "Google isn't set up on this server yet.",
};

export default async function CalendarSettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const workspace = await getCurrentWorkspace();
	if (!workspace) redirect("/");
	const [{ error }, settings] = await Promise.all([searchParams, readGoogleSettings(workspace.id)]);

	return (
		<SettingsPage title="Calendar">
			<SettingsSection
				title="Google Calendar"
				description="Both ways: Google's events on the home calendar, seikatsu's rows in Google."
			>
				{settings ? (
					<GoogleAccount settings={settings} />
				) : (
					<ConnectGoogle error={error ? (ERRORS[error] ?? ERRORS.exchange) : undefined} />
				)}
			</SettingsSection>
		</SettingsPage>
	);
}
