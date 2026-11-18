// The evening's first step: what the day piled up, logged in one place — habits, pages, the
// odometer, Apple Pay payments. The same parts as Today's, so each saves through its app.

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Suspense } from "react";
import { LineSkeleton, Seal } from "@/features/home/components/Line";
import { CarLine, Habits, ReadingLine } from "@/features/home/components/TodayView";
import { plural } from "@/features/home/lib/format";

export function EveningLog({ today, payments }: { today: string; payments: number }) {
	return (
		<div className="space-y-6">
			<section aria-label="Habits">
				<h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">Habits</h2>
				<div className="group-card">
					<Suspense
						fallback={
							<ul>
								<LineSkeleton />
							</ul>
						}
					>
						<Habits />
					</Suspense>
				</div>
			</section>
			<section aria-label="Reading, the car and money">
				<h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">The rest of the day</h2>
				<ul className="inset-group">
					<Suspense fallback={<LineSkeleton />}>
						<ReadingLine />
					</Suspense>
					<Suspense fallback={<LineSkeleton />}>
						<CarLine today={today} />
					</Suspense>
					{payments > 0 && (
						<li>
							<Link
								href="/kuroji?capture=all"
								prefetch
								className="group flex min-h-14 items-center gap-3 py-2 outline-none"
							>
								<Seal href="/kuroji" />
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-medium group-hover:underline">
										{plural(payments, "Apple Pay payment")} to add
									</span>
									<span className="block truncate text-xs text-muted-foreground">
										One after another, in Kuroji's form
									</span>
								</span>
								<HugeiconsIcon
									icon={ArrowRight01Icon}
									aria-hidden
									className="size-4 text-muted-foreground"
								/>
							</Link>
						</li>
					)}
				</ul>
			</section>
		</div>
	);
}
