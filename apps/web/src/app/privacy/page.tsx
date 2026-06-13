import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Privacy Policy — Seikatsu",
	description: "How Seikatsu handles your data.",
};

export default function PrivacyPage() {
	return (
		<main className="mx-auto max-w-2xl px-6 py-16">
			<h1 className="mb-2 text-2xl font-semibold">Privacy Policy</h1>
			<p className="mb-8 text-sm text-muted-foreground">Last updated: 13 June 2026</p>

			<div className="space-y-6 text-sm leading-relaxed">
				<section>
					<h2 className="mb-2 text-base font-semibold">Who we are</h2>
					<p>
						Seikatsu is a personal finance application operated privately by an individual for their
						own use. It is not a commercial service and has no other end users. Contact:{" "}
						<a className="underline" href="mailto:d.morhun@goldenratio.exchange">
							d.morhun@goldenratio.exchange
						</a>
						.
					</p>
				</section>

				<section>
					<h2 className="mb-2 text-base font-semibold">What data we access</h2>
					<p>
						With your explicit consent, Seikatsu uses Open Banking (PSD2) via Enable Banking to read{" "}
						<strong>account information</strong> and <strong>transaction history</strong> from bank
						accounts you connect. We do not initiate payments. Access is read-only and granted for a
						limited period (up to 90 days), after which you must re-authorize.
					</p>
				</section>

				<section>
					<h2 className="mb-2 text-base font-semibold">How we use it</h2>
					<p>
						Imported transactions are stored in your private workspace solely to display balances,
						categorize spending, and track net worth. Data is never sold, shared, or used for
						advertising or profiling.
					</p>
				</section>

				<section>
					<h2 className="mb-2 text-base font-semibold">Storage and retention</h2>
					<p>
						Data is stored in a private PostgreSQL database. Bank access credentials (tokens) are
						held only as needed to fetch transactions and expire automatically. You can disconnect a
						bank or delete imported data at any time from within the app.
					</p>
				</section>

				<section>
					<h2 className="mb-2 text-base font-semibold">Third parties</h2>
					<p>
						Bank connectivity is provided by Enable Banking Oy, a regulated Account Information
						Service Provider (FIN-FSA, Finland). Authentication is provided by GitHub OAuth. No
						other third parties receive your financial data.
					</p>
				</section>

				<section>
					<h2 className="mb-2 text-base font-semibold">Your rights</h2>
					<p>
						You may revoke bank access, request deletion of your data, or ask what is stored by
						contacting the email above.
					</p>
				</section>
			</div>
		</main>
	);
}
