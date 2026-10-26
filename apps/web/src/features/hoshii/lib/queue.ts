// The Now page's three groups, and how the piggy funds the Plan. Pure.

export type HoshiiState = "cooling" | "plan" | "bought" | "released";

type Queueable = {
	state: HoshiiState;
	coolUntil: string;
	planPosition: string | null;
	createdAt: Date;
};

/**
 * Decide: cooling is over, oldest first. Cooling: still waiting, soonest first.
 * Plan: the one ranking, in its order.
 */
export function splitQueue<T extends Queueable>(items: T[], today: string) {
	const byCool = (a: T, b: T) => a.coolUntil.localeCompare(b.coolUntil);
	const cooling = items.filter((i) => i.state === "cooling");
	return {
		decide: cooling.filter((i) => i.coolUntil <= today).sort(byCool),
		cooling: cooling.filter((i) => i.coolUntil > today).sort(byCool),
		plan: sortPlan(items.filter((i) => i.state === "plan")),
	};
}

/** Plan order; one without a position (never ranked) goes last, oldest first. */
export function sortPlan<T extends Pick<Queueable, "planPosition" | "createdAt">>(items: T[]): T[] {
	return [...items].sort((a, b) => {
		if (a.planPosition && b.planPosition) {
			return a.planPosition < b.planPosition ? -1 : a.planPosition > b.planPosition ? 1 : 0;
		}
		if (a.planPosition) return -1;
		if (b.planPosition) return 1;
		return a.createdAt.getTime() - b.createdAt.getTime();
	});
}

export type Funded<T> = {
	item: T;
	/** The price in the piggy's currency; null when unknown (no price, no rate). */
	cost: number | null;
	/** How much of it the piggy covers. */
	funded: number;
	/** 1 = can buy. Null when the cost is unknown. */
	share: number | null;
};

/** The piggy's balance fills the Plan top-down. Unknown costs take nothing. */
export function fundPlan<T>(plan: { item: T; cost: number | null }[], balance: number) {
	let left = Math.max(0, balance);
	return plan.map(({ item, cost }): Funded<T> => {
		if (cost == null || cost <= 0) {
			return { item, cost, funded: 0, share: cost === 0 ? 1 : null };
		}
		const funded = Math.min(left, cost);
		left -= funded;
		return { item, cost, funded, share: funded / cost };
	});
}
