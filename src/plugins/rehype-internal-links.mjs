/**
 * rehype 插件：把 `ama://` 开头的站内链接改写成带站点 base 的路径。
 *
 * 作者直接写 `/posts/x/` 时，Astro 不会补 `base`（`import.meta.env.BASE_URL`），
 * 部署在子路径（如 `/amara-blog`）就会 404。作者显式声明 `ama://` 即表示
 * 「这是站内路径，请按当前站点的 base 解析」，插件的唯一职责就是把 scheme
 * 去掉、拼上 base，其余 href 一律不动。
 *
 * base 的来源分两种运行上下文：
 * - Vite 上下文（页面渲染、`content-utils` 里的动态内容）：`import.meta.env.BASE_URL`
 *   会被 Vite 静态替换，直接可用；
 * - Node 上下文（`src/integration` 通过 `loadPackageModule` 加载本模块，再把 processor
 *   交给 Astro）：`import.meta.env` 不存在，改用 integration 在 `astro:config:setup`
 *   里写入的 `setInternalLinkBase()`。
 */

import { visit } from "unist-util-visit";

/** 作者声明站内链接的 scheme；`ama://`、`ama:/`、`ama:` 都接受。 */
const SITE_SCHEME = /^ama:\/*/i;

/** Node 上下文下由 integration 注入的 base（含首尾斜杠）。 */
let configuredBase = "/";

/**
 * 归一化 base：空值或 `/` 一律视为根；其余补前导与尾随斜杠。
 * @param {unknown} base
 * @returns {string}
 */
function normalizeBase(base) {
	const value = typeof base === "string" ? base.trim() : "";
	if (!value || value === "/") return "/";
	return `/${value.replace(/^\/+/, "").replace(/\/+$/, "")}/`;
}

/**
 * 写入 Node 上下文的站点 base。由 `src/integration` 在配置阶段调用。
 * @param {unknown} base
 * @returns {void}
 */
export function setInternalLinkBase(base) {
	configuredBase = normalizeBase(base);
}

/**
 * 解析当前生效的 base：优先 Vite 的 `BASE_URL`，否则用注入值。
 * @returns {string}
 */
function resolveBase() {
	const env = import.meta.env;
	const fromEnv =
		env && typeof env.BASE_URL === "string" ? normalizeBase(env.BASE_URL) : "";
	return fromEnv || configuredBase;
}

/**
 * 把 `ama://posts/x/` 这类 href 改写为 `${base}posts/x/`，保留 `#` 与 `?` 部分。
 * @param {string} href
 * @param {string} base
 * @returns {string}
 */
export function resolveInternalHref(href, base = resolveBase()) {
	const match = SITE_SCHEME.exec(href);
	if (!match) return href;
	const rest = href.slice(match[0].length).replace(/^\/+/, "");
	return `${normalizeBase(base)}${rest}`;
}

/**
 * rehype attacher：只读取 `a[href]`，写入同一个 `href`，不新增节点。
 * @returns {(tree: import("hast").Root) => void}
 */
export function rehypeInternalLinks() {
	return (tree) => {
		visit(tree, "element", (node) => {
			if (node.tagName !== "a") return;
			const properties = node.properties;
			if (!properties) return;
			const href = properties.href;
			if (typeof href !== "string" || !SITE_SCHEME.test(href)) return;
			properties.href = resolveInternalHref(href);
		});
	};
}
