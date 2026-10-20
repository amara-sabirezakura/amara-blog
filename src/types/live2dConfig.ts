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

/**
 * 取景方式：
 * - `full`：整个模型适配画框（默认，全身可见）；
 * - `bust`：只取上半身 —— 放大后顶部对齐，腰部以下被画框裁掉。
 */
export type Live2DFraming = "full" | "bust";

/** 模型来源标注；四个字段全为空时组件不渲染标注块。 */
export interface Live2DCredit {
	/** 模型标题（如角色名） */
	title: string;
	/** 模型标题的跳转链接（可选，留空则只显示文本） */
	titleUrl?: string;
	/** 模型作者 */
	author: string;
	/** 作者的跳转链接（可选，留空则只显示文本） */
	authorUrl?: string;
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
	/** 取景方式，默认 "full"；"bust" 只显示上半身 */
	framing?: Live2DFraming;
	/**
	 * 取景预设之上的额外缩放倍率，默认 1（>1 更近、<1 更远）。
	 * 换模型时若取景裁到头顶或留白过多，用它微调，不必改代码。
	 */
	zoom?: number;
	/** 受控设备矩阵，省略表示全设备生效 */
	devices?: Live2DDeviceTarget[];
	/** 模型来源标注，全空则不渲染 */
	credit?: Live2DCredit;
	/**
	 * 是否在系统「减少动效」时冻结小人（默认 false）。
	 * 小人只会在访客点击按钮后才加载，属于用户主动发起的动效，默认不因系统偏好停下；
	 * 需要严格遵循无障碍偏好时设为 true，此时不播 Idle、也不做视线跟随。
	 */
	pauseOnReducedMotion?: boolean;
}
