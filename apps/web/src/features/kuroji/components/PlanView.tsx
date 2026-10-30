"use client";

import { startNavigationProgress } from "@/components/NavigationProgress";
import type { PlanData } from "@/features/kuroji/actions/plan";
import { FundDialog, type FundTarget } from "@/features/kuroji/components/FundDialog";
import { Figure } from "@/features/kuroji/components/OverviewFigures";
import { PlanAmountDialog, type PlanTarget } from "@/features/kuroji/components/PlanAmountDialog";
import { parseLocal } from "@/features/kuroji/lib/dates";
import { formatCurrency } from "@/features/kuroji/lib/format";
import type { PlanRow } from "@/features/kuroji/lib/plan";
import { shiftMonth } from "@/features/kuroji/lib/plan";
import { BAR_FILL, barClip } from "@/lib/bar";
import { pageKey } from "@/lib/capture-shortcut";
import {
	Add01Icon,
	ArrowLeft01Icon,
	ArrowRight01Icon,
	CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, cn } from "@seikatsu/ui";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";

export const planHref = (month: string, current: string) =>
	month === current ? "/kuroji?tab=plan" : `/kuroji?tab=plan&month=${month}`;

const monthLabel = (month: string) => format(parseLocal(`${month}-01`), "MMMM yyyy");
const monthName = (month: string) => format(parseLocal(`${month}-01`), "MMMM");
const dayLabel = (date: string) => format(parseLocal(date), "MMM d");

interface Props {
	data: PlanData;
	workspaceId: string;
	/** Rendered when the month has nothing planned yet. */
	empty?: ReactNode;
}

/**
 * The month as planned: what's free, how each category is doing against the day of the month,
 * what's still to come, and whether the trips are on track.
 */
export function PlanView({ data, workspaceId, empty }: Props) {
	const { month, today, progress, currency, totals } = data;
	const current = today.slice(0, 7);
	const router = useRouter();

	const [planTarget, setPlanTarget] = useState<PlanTarget | null>(null);
	const [planOpen, setPlanOpen] = useState(false);
	const [suggested, setSuggested] = useState<number | undefined>();
	const [fund, setFund] = useState<FundTarget | null>(null);
	const [fundOpen, setFundOpen] = useState(false);

	function editPlan(target: PlanTarget | null, prefill?: number) {
		setPlanTarget(target);
		setSuggested(prefill);
		setPlanOpen(true);
	}
	function editFund(target: FundTarget | null) {
		setFund(target);
		setFundOpen(true);
	}

	const planned = useMemo(
		() => new Set([...data.expense, ...data.income].map((r) => r.accountId)),
		[data.expense, data.income],
	);
	const choices = data.categories.filter((c) => !planned.has(c.id));

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			if (k === "[" || k === "]") {
				startNavigationProgress();
				router.push(planHref(shiftMonth(month, k === "[" ? -1 : 1), current));
			} else if (k === "f") {
				setFund(null);
				setFundOpen(true);
			} else if (k === "p") {
				setPlanTarget(null);
				setSuggested(undefined);
				setPlanOpen(true);
			} else return;
			e.preventDefault();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [router, month, current]);

	const showPace = month === current;
	const fixed = data.expense.filter((r) => r.fixed);
	const variable = data.expense.filter((r) => !r.fixed);
	const nothingPlanned =
		data.expense.length === 0 && data.income.length === 0 && data.funds.length === 0;

	return (
		<div className="space-y-10">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<MonthSwitch month={month} current={current} />
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5"
						aria-keyshortcuts="P"
						onClick={() => editPlan(null)}
					>
						<HugeiconsIcon icon={Add01Icon} className="size-4" />
						Plan a category
					</Button>
				</div>
			</div>

			{nothingPlanned && empty ? (
				empty
			) : (
				<>
					<section aria-label="Summary" className="figure-row md:grid-cols-[1.4fr_1fr_1fr]">
						<div className="col-span-2 md:col-span-1">
							<Figure
								lead
								index={0}
								label={month === current ? "Free this month" : `Free in ${monthName(month)}`}
								value={totals.free}
								currency={currency}
								tone={totals.free < 0 ? "negative" : undefined}
								note={
									totals.incomePlan > 0
										? `${formatCurrency(totals.incomePlan, currency)} in − ${formatCurrency(totals.expensePlan, currency)} planned${totals.instalments > 0 ? ` − ${formatCurrency(totals.instalments, currency)} funds` : ""}`
										: "Set expected income to see what's free"
								}
							/>
						</div>
						<Figure
							index={1}
							label="Income"
							value={totals.incomeActual}
							currency={currency}
							tone="positive"
							note={
								totals.incomePlan > 0
									? `of ${formatCurrency(totals.incomePlan, currency)} expected`
									: undefined
							}
						/>
						<Figure
							index={2}
							label="Spent"
							value={totals.expenseActual}
							currency={currency}
							tone={
								totals.expenseActual > totals.expensePlan && totals.expensePlan > 0
									? "negative"
									: undefined
							}
							note={
								totals.expensePlan > 0
									? `of ${formatCurrency(totals.expensePlan, currency)} planned`
									: undefined
							}
						/>
					</section>

					<div
						className="grid animate-rise gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12"
						style={{ "--i": 3 } as CSSProperties}
					>
						<div className="space-y-10">
							<section aria-labelledby="plan-categories">
								<div className="mb-3 flex items-baseline justify-between gap-3">
									<h2 id="plan-categories" className="text-sm font-medium">
										Categories
									</h2>
									{showPace && (
										<p className="font-figures text-xs text-muted-foreground">
											Day {progress.elapsed} of {progress.days}
										</p>
									)}
								</div>
								{data.expense.length === 0 ? (
									<p className="py-4 text-sm text-muted-foreground">
										No category is planned for {monthName(month)}.
									</p>
								) : (
									<div className="space-y-6">
										{fixed.length > 0 && variable.length > 0 ? (
											<>
												<RowGroup title="Bills">
													{fixed.map((r) => (
														<CategoryRow
															key={r.accountId}
															row={r}
															currency={currency}
															pace={showPace ? progress.share : null}
															onEdit={() => editPlan({ ...r, type: "EXPENSE" })}
														/>
													))}
												</RowGroup>
												<RowGroup title="Everyday">
													{variable.map((r) => (
														<CategoryRow
															key={r.accountId}
															row={r}
															currency={currency}
															pace={showPace ? progress.share : null}
															onEdit={() => editPlan({ ...r, type: "EXPENSE" })}
														/>
													))}
												</RowGroup>
											</>
										) : (
											<ol className="inset-group">
												{data.expense.map((r) => (
													<CategoryRow
														key={r.accountId}
														row={r}
														currency={currency}
														pace={showPace ? progress.share : null}
														onEdit={() => editPlan({ ...r, type: "EXPENSE" })}
													/>
												))}
											</ol>
										)}
									</div>
								)}
							</section>

							{data.unplanned.length > 0 && (
								<section aria-labelledby="plan-unplanned">
									<h2 id="plan-unplanned" className="mb-1 text-sm font-medium">
										Not planned
									</h2>
									<p className="mb-2 text-xs text-muted-foreground">
										Spending in categories without a plan. Tap one to plan it.
									</p>
									<ol className="inset-group">
										{data.unplanned.map((u) => {
											const category = data.categories.find((c) => c.id === u.accountId);
											return (
												<li key={u.accountId}>
													<button
														type="button"
														onClick={() =>
															category
																? editPlan(
																		{
																			accountId: u.accountId,
																			name: u.name,
																			type: "EXPENSE",
																			plan: 0,
																			overridden: false,
																			defaultPlan: 0,
																		},
																		u.actual,
																	)
																: undefined
														}
														className="flex w-full items-baseline justify-between gap-4 rounded-md py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
													>
														<span className="truncate text-sm">{u.name}</span>
														<span className="font-figures text-sm font-medium">
															{formatCurrency(u.actual, currency)}
														</span>
													</button>
												</li>
											);
										})}
									</ol>
								</section>
							)}
						</div>

						<div className="space-y-10">
							{data.income.length > 0 && (
								<section aria-labelledby="plan-income">
									<h2 id="plan-income" className="mb-3 text-sm font-medium">
										Income
									</h2>
									<ol className="inset-group">
										{data.income.map((r) => (
											<IncomeRow
												key={r.accountId}
												row={r}
												currency={currency}
												onEdit={() => editPlan({ ...r, type: "INCOME" })}
											/>
										))}
									</ol>
								</section>
							)}

							<section aria-labelledby="plan-funds">
								<div className="mb-3 flex items-baseline justify-between gap-3">
									<h2 id="plan-funds" className="text-sm font-medium">
										Funds
									</h2>
									{data.assetAccounts.length > 0 && (
										<button
											type="button"
											aria-keyshortcuts="F"
											onClick={() => editFund(null)}
											className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
										>
											New fund
										</button>
									)}
								</div>
								{data.funds.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										Put money aside for a date — a trip, a big purchase.
									</p>
								) : (
									<ol className="inset-group">
										{data.funds.map((f) => (
											<li key={f.id}>
												<button
													type="button"
													onClick={() => editFund(f)}
													className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 rounded-md py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
												>
													<span className="truncate text-sm">
														{f.name}
														<span className="text-muted-foreground">
															{" "}
															· by {dayLabel(f.dueDate)}
														</span>
													</span>
													<span className="font-figures text-sm font-medium">
														{formatCurrency(f.filled, currency)}
														<span className="text-muted-foreground">
															{" "}
															/ {formatCurrency(f.target, currency)}
														</span>
													</span>
													<Bar share={f.filled / f.target} full={f.filled >= f.target} />
													<span className="col-span-2 text-xs text-muted-foreground">
														{f.filled >= f.target ? (
															<span className="text-positive">Fully funded</span>
														) : f.instalment === 0 ? (
															"Nothing more to put aside"
														) : f.onTrack ? (
															<span className="inline-flex items-center gap-1 text-positive">
																<HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
																{formatCurrency(f.instalment, currency)} put aside in{" "}
																{monthName(month)}
															</span>
														) : (
															`Put aside ${formatCurrency(f.instalment, currency)} in ${monthName(month)} · ${f.accountName}`
														)}
													</span>
												</button>
											</li>
										))}
									</ol>
								)}
							</section>

							<section aria-labelledby="plan-upcoming">
								<h2 id="plan-upcoming" className="mb-3 text-sm font-medium">
									Still to come
								</h2>
								{data.upcoming.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										No recurring transactions left in {monthName(month)}.
									</p>
								) : (
									<ol className="inset-group">
										{data.upcoming.map((u) => (
											<li
												key={u.id}
												className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-baseline gap-3 py-2.5"
											>
												<span className="font-figures text-xs text-muted-foreground">
													{dayLabel(u.date)}
												</span>
												<span className="truncate text-sm">{u.description || u.target}</span>
												<span
													className={cn(
														"font-figures text-sm",
														u.kind === "income" && "text-positive",
													)}
												>
													{u.kind === "income" ? "+" : ""}
													{formatCurrency(u.amount, currency)}
												</span>
											</li>
										))}
									</ol>
								)}
							</section>
						</div>
					</div>
				</>
			)}

			<PlanAmountDialog
				open={planOpen}
				onOpenChange={setPlanOpen}
				target={planTarget}
				choices={choices}
				suggested={suggested}
				month={month}
				monthLabel={monthName(month)}
				currency={currency}
			/>
			<FundDialog
				open={fundOpen}
				onOpenChange={setFundOpen}
				workspaceId={workspaceId}
				fund={fund}
				accounts={data.assetAccounts}
			/>
		</div>
	);
}

function MonthSwitch({ month, current }: { month: string; current: string }) {
	const arrow =
		"flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none";
	return (
		<nav aria-label="Month" className="flex items-center gap-1">
			<Link
				href={planHref(shiftMonth(month, -1), current)}
				prefetch
				aria-label="Previous month"
				aria-keyshortcuts="["
				className={arrow}
			>
				<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
			</Link>
			<h2 className="min-w-36 text-center text-base font-medium">{monthLabel(month)}</h2>
			<Link
				href={planHref(shiftMonth(month, 1), current)}
				prefetch
				aria-label="Next month"
				aria-keyshortcuts="]"
				className={arrow}
			>
				<HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
			</Link>
			{month !== current && (
				<Link
					href={planHref(current, current)}
					prefetch
					className="ml-2 text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
				>
					This month
				</Link>
			)}
		</nav>
	);
}

function RowGroup({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div>
			<h3 className="text-xs text-muted-foreground">{title}</h3>
			<ol className="inset-group">{children}</ol>
		</div>
	);
}

/** Fills as money goes; a tick marks where spending would be if it ran evenly through the month. */
function Bar({
	share,
	over = false,
	full = false,
	pace = null,
}: {
	share: number;
	over?: boolean;
	full?: boolean;
	pace?: number | null;
}) {
	return (
		<span aria-hidden className="relative col-span-2 h-1 rounded-full bg-surface-2">
			<span
				className={cn(
					"absolute inset-0 rounded-full",
					BAR_FILL,
					over ? "bg-negative" : full ? "bg-positive" : "bg-primary/80",
				)}
				style={barClip(Math.min(Math.max(share, 0), 1))}
			/>
			{pace != null && (
				<span
					className="absolute -top-1 h-3 w-px bg-foreground/50"
					style={{ left: `${pace * 100}%` }}
				/>
			)}
		</span>
	);
}

function CategoryRow({
	row,
	currency,
	pace,
	onEdit,
}: {
	row: PlanRow;
	currency: string;
	pace: number | null;
	onEdit: () => void;
}) {
	const over = row.actual > row.plan;
	const heading = !over && row.forecast != null && row.forecast > row.plan * 1.02;
	const left = row.plan - row.actual;

	return (
		<li>
			<button
				type="button"
				onClick={onEdit}
				onKeyDown={(e) => {
					if (pageKey(e.nativeEvent) === "e") {
						e.preventDefault();
						onEdit();
					}
				}}
				aria-keyshortcuts="E"
				className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 rounded-md py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<span className="truncate text-sm">
					{row.name}
					{row.overridden && <span className="text-xs text-muted-foreground"> · this month</span>}
				</span>
				<span className="font-figures text-sm font-medium">
					{formatCurrency(row.actual, currency)}
					<span className="text-muted-foreground"> / {formatCurrency(row.plan, currency)}</span>
				</span>
				<Bar share={row.actual / row.plan} over={over} pace={pace} />
				<span
					className={cn(
						"col-span-2 text-xs",
						over || heading ? "text-negative" : "text-muted-foreground",
					)}
				>
					{over
						? `${formatCurrency(-left, currency)} over`
						: heading
							? `Heading for ${formatCurrency(row.forecast ?? 0, currency)}`
							: `${formatCurrency(left, currency)} left`}
					{!over && row.upcoming > 0 && (
						<span className="text-muted-foreground">
							{" "}
							· {formatCurrency(row.upcoming, currency)} still due
						</span>
					)}
				</span>
			</button>
		</li>
	);
}

function IncomeRow({
	row,
	currency,
	onEdit,
}: {
	row: PlanRow;
	currency: string;
	onEdit: () => void;
}) {
	const toCome = row.plan - row.actual;
	return (
		<li>
			<button
				type="button"
				onClick={onEdit}
				className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 rounded-md py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<span className="truncate text-sm">
					{row.name}
					{row.overridden && <span className="text-xs text-muted-foreground"> · this month</span>}
				</span>
				<span className="font-figures text-sm font-medium">
					{formatCurrency(row.actual, currency)}
					<span className="text-muted-foreground"> / {formatCurrency(row.plan, currency)}</span>
				</span>
				<Bar share={row.actual / row.plan} full={row.actual >= row.plan} />
				<span className="col-span-2 text-xs text-muted-foreground">
					{toCome > 0 ? `${formatCurrency(toCome, currency)} to come` : "All in"}
				</span>
			</button>
		</li>
	);
}
