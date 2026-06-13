import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Terms of Service — Seikatsu",
	description: "Terms for using Seikatsu.",
};

export default function TermsPage() {
	return (
		<main className="mx-auto max-w-2xl px-6 py-16">
			<h1 className="mb-2 text-2xl font-semibold">Terms of Service</h1>
			<p className="mb-8 text-sm text-muted-foreground">Last updated: 13 June 2026</p>

			<div className="space-y-6 text-sm leading-relaxed">
				<section>
					<h2 className="mb-2 text-base font-semibold">1. Nature of the service</h2>
					<p>
						Seikatsu is a private, personal-use finance application. It is provided "as is", without
						warranty of any kind, for the sole use of its operator. It is not offered to the public
						and creates no commercial relationship.
					</p>
				</section>

				<section>
					<h2 className="mb-2 text-base font-semibold">2. Bank connections</h2>
					<p>
						Bank account access is provided through Open Banking (PSD2) via Enable Banking Oy under
						its own regulatory licence. By connecting an account you authorize Seikatsu to read your
						account information and transactions on a read-only basis. You may revoke this access at
						any time through the app or your bank.
					</p>
				</section>

				<section>
					<h2 className="mb-2 text-base font-semibold">3. Accuracy</h2>
					<p>
						Imported and computed figures are for informational purposes only and may contain
						errors. They are not financial advice and should not be relied upon for tax, legal, or
						investment decisions.
					</p>
				</section>

				<section>
					<h2 className="mb-2 text-base font-semibold">4. Limitation of liability</h2>
					<p>
						The operator accepts no liability for any loss arising from use of the application,
						including inaccuracies, downtime, or data loss, to the maximum extent permitted by law.
					</p>
				</section>

				<section>
					<h2 className="mb-2 text-base font-semibold">5. Changes</h2>
					<p>
						These terms may be updated at any time. Continued use after a change constitutes
						acceptance of the revised terms.
					</p>
				</section>

				<section>
					<h2 className="mb-2 text-base font-semibold">6. Contact</h2>
					<p>
						Questions:{" "}
						<a className="underline" href="mailto:danymorhun@gmail.com">
							danymorhun@gmail.com
						</a>
						.
					</p>
				</section>
			</div>
		</main>
	);
}
