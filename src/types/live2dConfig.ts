/**
 * Live2D 桌面小人（桌宠）类型定义。
 * 值与默认配置见 src/config/live2dConfig.ts。
 */

/**
 * 允许渲染桌宠的目标设备：
 * - mobile：移动端视口（< 768px）
 * - tablet：平板视口（768px ~ 1023px）
 * - desktop：桌面视口（>= 1024px）
 *
 * 省略或传入空数组时默认在所有设备上生效。
 */
export type Live2DDeviceTarget = "mobile" | "tablet" | "desktop";

/** 桌宠贴边方向，默认 "left"（右下角已被 FAB 悬浮控制流占用）。 */
export type Live2DSide = "left" | "right";

/** 模型来源标注；四个字段全为空时组件不渲染标注块。 */
export interface Live2DCredit {
	/** 模型标题（如角色名） */
	title: string;
	/** 模型作者 */
	author: string;
	/** 授权声明（如 "CC BY-NC 4.0" 或自定义说明） */
	license: string;
	/** 来源链接，留空则不输出链接 */
	url: string;
}

export interface Live2DConfig {
	/** 是否启用 Live2D 桌宠；默认 false（零额外负担） */
	enable: boolean;
	/**
	 * 模型清单（model3.json）路径。
	 * 站内 public 路径（如 "/live2d/guiz/guiz.model3.json"，由 url() 补站点 base）
	 * 或完整远程 URL；留空视为未配置。
	 */
	modelPath: string;
	/** 贴边方向，默认 "left" */
	side?: Live2DSide;
	/** 渲染尺寸（CSS 长度值），默认 "15rem" */
	size?: string;
	/** 受控设备矩阵，省略表示全设备生效 */
	devices?: Live2DDeviceTarget[];
	/** 模型来源标注，全空则不渲染 */
	credit?: Live2DCredit;
}
