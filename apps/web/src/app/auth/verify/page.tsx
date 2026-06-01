import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@seikatsu/ui/card";

export default function VerifyPage() {
	return (
		<main className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-sm text-center">
				<CardHeader>
					<CardTitle>Check your email</CardTitle>
					<CardDescription>We sent a sign-in link. Open it on any device.</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm">
						Link expires in 24 hours. You can close this tab.
					</p>
				</CardContent>
			</Card>
		</main>
	);
}
