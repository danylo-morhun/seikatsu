import { cn } from "@seikatsu/ui";

/**
 * The first box leads wide; the last one stretches so the grid closes square at any count
 * (two columns up to lg, three from it).
 */
export function spanOf(index: number, count: number): string {
	if (index === 0) return count === 1 ? "col-span-2 lg:col-span-3" : "col-span-2";
	if (index !== count - 1) return "";
	// Cells used if the last box took one: the lead takes two, the rest one each.
	const cells = count + 1;
	const phone = cells % 2 === 1 ? "col-span-2" : "";
	const leftInRow = cells % 3; // boxes already in the last lg row, counting this one
	const wide =
		leftInRow === 1
			? "lg:col-span-3"
			: leftInRow === 2
				? "lg:col-span-2"
				: phone && "lg:col-span-1";
	return cn(phone, wide);
}
