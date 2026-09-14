export const IGNORE_THRESHOLD_DAYS = 14;

// Rows in these statuses are scraper-sourced candidates that haven't actually been
// applied to yet — exclude them from application-rate analytics (stats.ts) so a
// backlog of unreviewed postings doesn't skew response rate / funnel / weekly trend.
export const PRE_APPLICATION_STATUSES = ["sourced", "drafted"] as const;
