import { IGNORE_THRESHOLD_DAYS } from "./constants";

interface IgnorableApplication {
	status: string;
	hrScreening: boolean;
	technicalInterview: boolean;
	offer: boolean;
	dateApplied: string;
}

export function isIgnored(app: IgnorableApplication): boolean {
	if (app.status !== "applied") return false;
	if (app.hrScreening || app.technicalInterview || app.offer) return false;
	const days = Math.floor((Date.now() - new Date(app.dateApplied).getTime()) / 86_400_000);
	return days > IGNORE_THRESHOLD_DAYS;
}
