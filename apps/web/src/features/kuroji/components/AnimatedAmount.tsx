"use client";

import NumberFlow from "@number-flow/react";

/**
 * A money figure whose digits roll to a new value (period change, new entry) instead of
 * swapping in place. Same format as `formatCurrency`, so server and client agree.
 */
export function AnimatedAmount({ value, currency }: { value: number; currency: string }) {
	return (
		<NumberFlow
			value={value}
			locales="pl-PL"
			format={{
				style: "currency",
				currency,
				currencyDisplay: "narrowSymbol",
				useGrouping: "always",
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			}}
		/>
	);
}
