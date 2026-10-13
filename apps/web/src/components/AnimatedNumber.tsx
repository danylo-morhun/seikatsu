"use client";

import NumberFlow from "@number-flow/react";

/** A count whose digits roll to a new value (year switch, new entry); AnimatedAmount's sibling. */
export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
	return (
		<NumberFlow
			value={value}
			locales="en-US"
			format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
		/>
	);
}
