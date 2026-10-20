/**
 * Site base for specs that navigate with absolute paths.
 *
 * Playwright resolves `page.goto("/posts/x")` against the origin, not against
 * `baseURL`, so a site deployed under a sub-path (`base: /amara-blog`) needs the
 * prefix added explicitly. `SITE_BASE` carries it; upstream-style root
 * deployments leave it unset and every path stays exactly as written.
 *
 * Set it when running locally against a sub-path site:
 * `$env:SITE_BASE = "/amara-blog"` (PowerShell) / `SITE_BASE=/amara-blog pnpm test`.
 */
const SITE_BASE = process.env.SITE_BASE ?? "";

export function sitePath(path: string): string {
	return `${SITE_BASE}${path}`;
}
