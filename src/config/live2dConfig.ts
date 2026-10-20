import type {
	Live2DConfig,
	Live2DCredit,
	Live2DDeviceTarget,
	Live2DSide,
} from "@/types/live2dConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * Live2D 桌面小人（桌宠）配置单一真源。
 *
 * 遵循「零额外负担」原则：默认关闭（enable: false）。未启用或 modelPath 为空时
 * 组件短路 `return null`，不输出任何 DOM / 样式，也不加载 pixi / 模型文件。
 *
 * 【启用步骤】
 * 1. 把模型文件放进 `public/live2d/<name>/`（注意模型授权，不允许二次分发时不要入仓）；
 * 2. `modelPath` 填写模型清单路径，如 "/live2d/guiz/guiz.model3.json"
 *    （站内路径会经 `url()` 补上站点 base；也可直接写远程 URL）；
 * 3. `enable` 置为 `true`；
 * 4. （可选）调整 `side` / `size` / `devices`，并填写 `credit` 做模型来源标注。
 *
 * 运行时（pixi.js 7 + pixi-live2d-display + Cubism Core）在进入视口后按需动态加载，
 * 不开启时零 npm bundle 膨胀。
 */
export const live2dConfig: Live2DConfig = withUserConfig("live2d", {
	/** 总开关：false 时完全不输出 DOM、样式与运行时资源 */
	enable: false,
	/** 模型清单路径（站内 public 路径或远程 URL），留空视为未配置 */
	modelPath: "",
	/** 贴边方向：右下角已被 FAB 占用，故默认贴左下 */
	side: "left",
	/** 渲染尺寸，默认 15rem */
	size: "15rem",
	/** 受控设备矩阵：默认在移动端（< 768px）隐藏 */
	devices: ["desktop", "tablet"],
	/** 模型来源标注，全空则不渲染标注块 */
	credit: {
		title: "",
		author: "",
		license: "",
		url: "",
	},
});

/** 归一化后的桌宠运行参数（校验已收敛在 resolveLive2DOptions）。 */
export interface ResolvedLive2DOptions {
	modelPath: string;
	side: Live2DSide;
	size: string;
	devices: Live2DDeviceTarget[];
	credit: Live2DCredit | null;
}

/**
 * 解析并校验桌宠配置。未启用或缺少 modelPath 时返回 null。
 * 校验收敛在此纯函数中，消费组件只消费解析结果并短路。
 */
export function resolveLive2DOptions(
	config: Live2DConfig = live2dConfig,
): ResolvedLive2DOptions | null {
	const modelPath = config.modelPath?.trim();
	if (!config.enable || !modelPath) {
		return null;
	}

	const credit = config.credit;
	const hasCredit = Boolean(
		credit &&
			(credit.title?.trim() ||
				credit.author?.trim() ||
				credit.license?.trim() ||
				credit.url?.trim()),
	);

	return {
		modelPath,
		side: config.side === "right" ? "right" : "left",
		size: config.size?.trim() || "15rem",
		devices: config.devices ?? [],
		credit: hasCredit
			? {
					title: credit?.title?.trim() ?? "",
					author: credit?.author?.trim() ?? "",
					license: credit?.license?.trim() ?? "",
					url: credit?.url?.trim() ?? "",
				}
			: null,
	};
}
