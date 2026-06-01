import { auth } from "@/auth";
import { HomeGrid } from "@/components/HomeGrid";
import { SignInCard } from "@/features/auth/components/SignInCard";

export default async function HomePage() {
	const session = await auth();

	if (session) {
		return <HomeGrid user={session.user} />;
	}

	return (
		<main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
			<div className="pointer-events-none absolute -top-1/3 -left-1/4 h-2/3 w-2/3 rounded-full bg-primary/10 blur-3xl" />
			<div className="pointer-events-none absolute -bottom-1/3 -right-1/4 h-2/3 w-2/3 rounded-full bg-primary/8 blur-3xl" />
			<SignInCard />
		</main>
	);
}
