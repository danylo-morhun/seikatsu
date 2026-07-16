import { signOutAction } from "@/features/auth/actions/auth";
import { KeizokuHomeWidget } from "@/features/keizoku/components/KeizokuHomeWidget";
import { APPS_CONFIG } from "@/lib/app-themes";
import { ArrowRight01Icon, Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, cn } from "@seikatsu/ui";
import Link from "next/link";

const PLANNED_APPS = [
	{
		name: "書 Books",
		kanji: "書",
		description: "Reading lists, progress tracking, and notes.",
		textClass: "text-violet-400",
		bgTintClass: "bg-violet-400/10",
		ringClass: "ring-violet-400/20",
		accentBarClass: "bg-violet-400",
	},
	{
		name: "願 Wishlist",
		kanji: "願",
		description: "Save and organize things you want.",
		textClass: "text-rose-400",
		bgTintClass: "bg-rose-400/10",
		ringClass: "ring-rose-400/20",
		accentBarClass: "bg-rose-400",
	},
];

function getGreeting() {
	const h = new Date().getHours();
	if (h < 5) return "Good night";
	if (h < 12) return "Good morning";
	if (h < 17) return "Good afternoon";
	return "Good evening";
}

interface Props {
	user: {
		id: string;
		name?: string | null;
		email?: string | null;
		image?: string | null;
	};
}

export function HomeGrid({ user }: Props) {
	const firstName = user.name?.split(" ")[0] ?? "there";

	return (
		<div className="relative min-h-screen bg-background text-foreground">
			{/* Ambient background blobs */}
			<div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
				<div className="absolute -top-1/3 -left-1/4 h-2/3 w-2/3 rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute -bottom-1/3 -right-1/4 h-2/3 w-2/3 rounded-full bg-primary/3 blur-3xl" />
			</div>

			<div className="relative mx-auto max-w-5xl px-6 pb-20">
				{/* Header */}
				<header className="flex items-center justify-between py-6">
					<Link href="/" className="flex items-center gap-2.5">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<span className="text-sm font-bold leading-none">生</span>
						</div>
						<span className="font-semibold tracking-tight">seikatsu</span>
					</Link>

					<div className="flex items-center gap-4">
						<Avatar src={user.image} name={user.name} size="sm" />
						<span className="hidden text-sm text-muted-foreground sm:block">{user.name}</span>
						<form action={signOutAction}>
							<button
								type="submit"
								className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							>
								<HugeiconsIcon icon={Logout01Icon} className="h-4 w-4" />
								<span className="hidden sm:inline">Sign out</span>
							</button>
						</form>
					</div>
				</header>

				{/* Hero */}
				<section className="pb-12 pt-8">
					<p className="text-sm font-medium text-muted-foreground">{getGreeting()}</p>
					<h1 className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">{firstName}</h1>
					<p className="mt-3 text-muted-foreground">Where would you like to go?</p>
				</section>

				{/* Active apps */}
				<section>
					<h2 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
						Apps
					</h2>
					<div className="grid gap-4 sm:grid-cols-2">
						{Object.entries(APPS_CONFIG).map(([href, app]) => (
							<Link
								key={href}
								href={href}
								className={cn(
									app.theme,
									"group relative block overflow-hidden rounded-2xl border border-border/50 bg-card p-6",
									"transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40",
								)}
							>
								{/* Top accent line */}
								<div className="absolute inset-x-0 top-0 h-[2px] bg-primary" />

								{/* Watermark kanji */}
								<div
									className="pointer-events-none absolute right-4 bottom-0 select-none text-[96px] font-bold leading-none text-primary opacity-[0.05] transition-opacity duration-200 group-hover:opacity-[0.09]"
									aria-hidden="true"
								>
									{app.kanji}
								</div>

								{/* Top-right arrow — appears on hover */}
								<div className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 opacity-0 transition-all duration-200 group-hover:opacity-100">
									<HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
								</div>

								{/* Content */}
								<div className="relative">
									<div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary ring-1 ring-primary/20">
										{app.kanji}
									</div>

									<h3 className="text-base font-semibold">{app.name}</h3>
									<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
										{app.description}
									</p>
									{href === "/keizoku" && <KeizokuHomeWidget userId={user.id} />}
								</div>
							</Link>
						))}
					</div>
				</section>

				{/* Planned apps */}
				<section className="mt-14">
					<h2 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
						Coming soon
					</h2>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{PLANNED_APPS.map((app) => (
							<div
								key={app.name}
								className="relative overflow-hidden rounded-2xl border border-border/30 bg-card/50 p-6"
							>
								{/* Top accent line (dimmed) */}
								<div
									className={cn("absolute inset-x-0 top-0 h-[2px] opacity-30", app.accentBarClass)}
								/>

								{/* Watermark kanji */}
								<div
									className={cn(
										"pointer-events-none absolute right-4 bottom-0 select-none text-[96px] font-bold leading-none opacity-[0.04]",
										app.textClass,
									)}
									aria-hidden="true"
								>
									{app.kanji}
								</div>

								{/* Top-right Soon badge */}
								<span className="absolute top-4 right-4 inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
									Soon
								</span>

								{/* Content */}
								<div className="relative opacity-50">
									<div
										className={cn(
											"mb-5 flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold ring-1",
											app.bgTintClass,
											app.textClass,
											app.ringClass,
										)}
									>
										{app.kanji}
									</div>

									<h3 className="text-base font-semibold">{app.name}</h3>
									<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
										{app.description}
									</p>
								</div>
							</div>
						))}
					</div>
				</section>
			</div>
		</div>
	);
}
