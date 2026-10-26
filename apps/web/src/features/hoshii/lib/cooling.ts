// How long a new want cools before Hoshii asks "still want it?". Pure.

export type CoolingTiers = {
	smallBelow: number;
	largeFrom: number;
	smallDays: number;
	midDays: number;
	largeDays: number;
};

export const DEFAULT_TIERS: CoolingTiers = {
	smallBelow: 100,
	largeFrom: 1000,
	smallDays: 7,
	midDays: 30,
	largeDays: 60,
};

/** Days to cool by price in the base currency. An unknown price takes the middle tier. */
export function coolingDays(basePrice: number | null, tiers: CoolingTiers): number {
	if (basePrice == null) return tiers.midDays;
	if (basePrice < tiers.smallBelow) return tiers.smallDays;
	if (basePrice < tiers.largeFrom) return tiers.midDays;
	return tiers.largeDays;
}
