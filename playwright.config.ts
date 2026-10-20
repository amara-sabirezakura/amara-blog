import { defineConfig } from "@playwright/test";

/**
 * 组件质量专项 — Playwright 配置
 * 说明：测试针对 Astro 开发服务器上的 atoms-*-test 页面（组件库验证页）。
 * 复用系统 Chrome（channel: chrome），避免额外下载浏览器。
 */
export default defineConfig({
	testDir: "./tests",
	timeout: 30_000,
	expect: { timeout: 5_000 },
	// 截图命名去掉平台/项目后缀（-win32），且随 spec 文件旁存放
	snapshotPathTemplate:
		"{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [["list"]],
	use: {
		// 用例里的跳转都是绝对路径（`/posts/...`），Playwright 不会把 baseURL 的
		// 子路径补回去，所以子路径部署下的前缀由 `sitePath()` 统一添加。
		baseURL: `http://localhost:4321${process.env.SITE_BASE ?? ""}`,
		channel: "chrome",
		viewport: { width: 1280, height: 900 },
		trace: "retain-on-failure",
	},
	webServer: {
		command:
			process.platform === "win32"
				? "pnpm.cmd astro dev --port 4321 --host"
				: "pnpm astro dev --port 4321 --host",
		// 开发服务器会遵循 `base`，站点根路径在设了 base 后是 404，拿它做就绪探针
		// 永远等不到；Vite 的 client 入口固定在服务器根上，是 base 无关的探针。
		url: "http://localhost:4321/@vite/client",
		reuseExistingServer: true,
		timeout: 120_000,
		env: {
			ASTRO_DEV_BACKGROUND: "false",
		},
	},
});
