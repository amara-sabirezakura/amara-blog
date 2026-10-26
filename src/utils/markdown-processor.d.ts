/** markdown-processor.mjs 的类型面（实现文件为 .mjs，astro.config 与 content-utils 共用） */

export interface SiteMarkdownRenderResult {
	code: string;
	metadata: Record<string, unknown>;
}

export interface SiteMarkdownRenderer {
	render(
		content: string,
		renderOpts?: {
			fileURL?: URL;
			frontmatter?: Record<string, unknown>;
		},
	): Promise<SiteMarkdownRenderResult>;
}

export declare const siteMarkdownProcessor: {
	name: "unified";
	options: {
		remarkPlugins: unknown[];
		rehypePlugins: unknown[];
	};
	createRenderer(
		shared?: Record<string, unknown>,
	): Promise<SiteMarkdownRenderer>;
};

/**
 * Node 上下文（integration 加载的同一份模块）没有 `import.meta.env.BASE_URL`，
 * 由 integration 在配置阶段写入站点 base，供 `ama://` 站内链接改写使用。
 */
export declare function setInternalLinkBase(base: string | undefined): void;
