/**
 * Used as a route `template.tsx`: templates remount on every navigation within their
 * segment, so each new page settles in. It wraps only the page, never the layout's fixed
 * navs, because the entrance briefly transforms its box. Flex-grows like the page it holds.
 */
export function PageEnter({ children }: { children: React.ReactNode }) {
	return <div className="animate-page flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>;
}
