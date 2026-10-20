/**
 * Live2D 桌面小人运行时（客户端按需加载）。
 *
 * 只由 `Live2DPet.astro` 的 `<script>` 在「用户点开小人」那一刻动态 import，因此
 * pixi.js / pixi-live2d-display / Cubism Core 都不会进入主 bundle，收起态也
 * 不会产生任何 canvas、脚本或模型请求。
 *
 * 依赖组合（pixi-live2d-display 0.4.0 不支持 pixi 8，故锁 pixi 7）：
 * - `pixi.js` 7：Application 与渲染器；
 * - `pixi-live2d-display/cubism4`：Live2DModel（Cubism 4 运行时）；
 * - `live2dcubismcore`：Cubism Core。必须是「经典脚本」注入——该文件是
 *   sloppy-mode 包装，会在全局创建 `Live2DCubismCore`；作为 ES 模块导入时，
 *   其内部的隐式全局赋值会在严格模式下抛 ReferenceError。这里用 `?url`
 *   资源 + `loadScriptOnce()` 注入，仍是本域请求，不依赖任何第三方 CDN。
 *
 * Idle 动作由动作管理器自动循环播放；眨眼用的是上游自带的 CubismEyeBlink，但
 * 0.4.0 只在「本帧没有动作更新」时推进它，循环 Idle 会让眨眼被永久压制，因此这里在
 * `afterMotionUpdate` 事件里手动推进（见挂载逻辑）。表情切换由点击小人触发。
 *
 * 卸载（收起）必须把运行时不留痕迹地拆掉：销毁 Application（其自带 Ticker 随之销毁）、
 * 停掉 pixi 共享 Ticker（否则会留一个空转的 rAF 循环）、移除 canvas 与事件监听。
 *
 * 加载指示复用 `LoadingIndicator` 原子，但只在真正加载的那段时间由本模块 `mount()` 挂上、
 * 结束（成功 / 失败 / 中途收起）立刻 `unmount()`：这样收起态不必为一个永不显示的空转
 * 指示器付出 bundle 与 rAF 的代价。
 */
import LoadingIndicator from "@components/atoms/feedback/LoadingIndicator.svelte";
import { prefersReducedMotion } from "@utils/motion";
import { loadScriptOnce } from "@utils/script-loader";
import cubismCoreSrc from "live2dcubismcore/live2dcubismcore.min.js?url";
import * as PIXI from "pixi.js";
import { mount, unmount } from "svelte";

declare global {
	interface Window {
		/** Cubism Core 由注入的经典脚本写入，运行时只做存在性检查 */
		Live2DCubismCore?: unknown;
		/** 挂载句柄：与 window.__shironeFab 同风格的调试/探针入口 */
		__shironeLive2D?: Live2DPetHandle | null;
	}
}

interface Live2DPetHandle {
	app: PIXI.Application;
	model: Live2DModelLike;
	switchExpression: () => void;
}

/** 只依赖本运行时实际用到的 Live2DModel 结构，避免耦合上游 d.ts 的 pixi 版本。 */
interface Live2DModelLike {
	internalModel: {
		width: number;
		height: number;
		/** 原始画布尺寸：视线方向按它归一化（与上游 Live2DModel.focus 同一套换算） */
		originalWidth: number;
		originalHeight: number;
		/** 视线控制器：x/y 为 [-1, 1] 的朝向分量，绝对值越大转头越多 */
		focusController: { focus(x: number, y: number, instant?: boolean): void };
		coreModel: {
			getParameterValueById(id: string): number;
		};
		motionManager: {
			expressionManager?: { definitions?: Array<{ Name?: string }> };
		};
		/** 模型清单声明了 EyeBlink 组时由上游创建 */
		eyeBlink?: { updateParameters(model: unknown, dt: number): void };
		on(event: string, handler: () => void): void;
	};
	scale: { set(x: number, y?: number): void };
	position: { set(x: number, y: number): void };
	width: number;
	height: number;
	autoUpdate: boolean;
	/** 推进一帧：累积内部 deltaTime，由 _render 消费（单位毫秒） */
	update(dt: number): void;
	/** pixi v7 专用属性：命中测试裁剪（见挂载处的说明） */
	eventMode?: string;
	expression(id?: string): Promise<boolean>;
	/** 视线跟随：入参为画布坐标系（CSS px，相对 canvas 左上角） */
	focus(x: number, y: number, instant?: boolean): void;
	/** 全局坐标 → 模型局部坐标（与上游 focus() 内部的换算同源） */
	toModelPosition(
		position: { x: number; y: number },
		result?: { x: number; y: number },
		skipUpdate?: boolean,
	): void;
}

interface Live2DModuleLike {
	Live2DModel: {
		from(
			source: string,
			options?: Record<string, unknown>,
		): Promise<Live2DModelLike>;
		registerTicker(tickerClass: unknown): void;
	};
}

/** 视线跟随幅度：1 = 上游默认（指针方向满偏），0.4 = 头部/眼睛只转到四成 */
const FOCUS_GAIN = 0.4;

/** 已挂载实例：宿主 → 控制器，用于成对卸载。 */
const controllers = new WeakMap<HTMLElement, PetController>();

interface PetController {
	app: PIXI.Application;
	stage: HTMLElement;
	canvas: HTMLCanvasElement;
	onCanvasClick: () => void;
	onResize: () => void;
	/** 视线跟随的三件拆除：指针监听、离开监听、挂起的 rAF */
	cancelFocus: () => void;
}

let cubismCorePromise: Promise<void> | null = null;

/** 确保 `window.Live2DCubismCore` 就绪（同一页面只注入一次）。 */
async function ensureCubismCore(): Promise<void> {
	if (typeof window === "undefined") return;
	if (window.Live2DCubismCore) return;
	cubismCorePromise ??= loadScriptOnce(cubismCoreSrc);
	await cubismCorePromise;
	if (!window.Live2DCubismCore) {
		throw new Error("Cubism Core 注入完成但 window.Live2DCubismCore 仍不可用");
	}
}

/** 宿主是否已被收起（用户可能在装载途中又点了一次收起）。 */
function isCollapsed(host: HTMLElement): boolean {
	return host.dataset.live2dState === "collapsed";
}

/**
 * 把小人摆进画框。
 * - `full`（默认）：整个模型等比适配画框并贴底居中（全身可见）；
 * - `bust`：按预设放大后**顶部对齐**，腰部以下落到画框外被裁掉（只显示上半身）。
 *   `data-live2d-zoom` 是预设之上的额外倍率，换模型时用来微调取景。
 */
function layoutModel(
	model: Live2DModelLike,
	stage: HTMLElement,
	host: HTMLElement,
): void {
	const width = stage.clientWidth;
	const height = stage.clientHeight;
	if (!width || !height) return;
	const modelWidth = model.internalModel.width;
	const modelHeight = model.internalModel.height;
	const framing = host.dataset.live2dFraming === "bust" ? "bust" : "full";
	const configuredZoom = Number.parseFloat(host.dataset.live2dZoom ?? "");
	const zoom =
		Number.isFinite(configuredZoom) && configuredZoom > 0 ? configuredZoom : 1;
	const fit = Math.min(width / modelWidth, height / modelHeight);
	// 「上半身」预设：放大到画框只框住大约「头 + 胸腹」这一段
	const preset = framing === "bust" ? 2 : 1;
	const scale = fit * preset * zoom;
	model.scale.set(scale);
	model.position.set(
		(width - modelWidth * scale) / 2,
		framing === "bust" ? 0 : height - modelHeight * scale,
	);
}

/** 释放一个已挂载实例：销毁渲染器、停 rAF、清 DOM 与全局句柄。 */
function disposeController(host: HTMLElement, controller: PetController): void {
	controller.cancelFocus();
	controller.canvas.removeEventListener("click", controller.onCanvasClick);
	window.removeEventListener("resize", controller.onResize);
	try {
		// v7 Application.destroy 会销毁它自带的 Ticker 与 renderer，并把 canvas 摘下来
		controller.app.destroy(true, { children: true, texture: true });
	} catch (error) {
		console.warn("[Shirone Live2D] 销毁渲染器时出错：", error);
	} finally {
		controller.stage.replaceChildren();
		// pixi 共享 Ticker 承载着模型自身的每帧回调，必须显式停掉，否则留一个空转 rAF
		PIXI.Ticker.shared.stop();
		delete host.dataset.live2dMounted;
		delete host.dataset.live2dExpression;
		if (window.__shironeLive2D?.app === controller.app) {
			window.__shironeLive2D = null;
		}
	}
}

/**
 * 把桌宠挂载到宿主元素上（展开态）。重复调用安全：同一宿主只初始化一次。
 * 若装载过程中宿主已被收起（`data-live2d-state="collapsed"`），会自行回滚且不留残留。
 */
export async function mountLive2DPet(host: HTMLElement): Promise<void> {
	const modelUrl = host.dataset.live2dModel;
	const stage = host.querySelector<HTMLElement>("[data-live2d-stage]");
	const spinnerSlot = host.querySelector<HTMLElement>("[data-live2d-spinner]");
	if (!modelUrl || !stage || controllers.has(host) || isCollapsed(host)) return;

	// 加载指示只在加载期间存在，收尾（finally）立刻卸载，避免留下空转的 rAF
	const spinner = spinnerSlot
		? mount(LoadingIndicator, { target: spinnerSlot })
		: null;

	try {
		await ensureCubismCore();
		const { Live2DModel } = (await import(
			"pixi-live2d-display/cubism4"
		)) as unknown as Live2DModuleLike;
		Live2DModel.registerTicker(PIXI.Ticker);

		// 模型 38MB 级下载，装载前再核对一次状态，别为已经收起的请求买单
		if (isCollapsed(host)) return;

		const app = new PIXI.Application({
			backgroundAlpha: 0,
			antialias: true,
			autoDensity: true,
			resolution: Math.min(window.devicePixelRatio || 1, 2),
			resizeTo: stage,
		});
		stage.appendChild(app.view as HTMLCanvasElement);

		const model = await Live2DModel.from(modelUrl, { autoInteract: false });
		if (isCollapsed(host)) {
			app.destroy(true, { children: true, texture: true });
			PIXI.Ticker.shared.stop();
			stage.replaceChildren();
			return;
		}
		app.stage.addChild(model as unknown as PIXI.Container);

		// pixi-live2d-display 0.4.0 的 @pixi/* 仍解析到 v6（其 peerDependencies 为 ^6），
		// 它的 Container 因而缺少 v7 的 isInteractive()。v7 的 EventBoundary 在命中测试
		// 时会调用 currentTarget.isInteractive()，于是每次指针掠过画布都抛 TypeError。
		// 本运行时不需要 pixi 事件系统（点击由画布上的 DOM 监听处理），
		// 用 v7 的属性把模型裁掉即可。
		model.eventMode = "none";

		// 眨眼：0.4.0 只在「本帧没有动作更新」时才推进它自己的 CubismEyeBlink
		// （`if (!motionUpdated) eyeBlink.updateParameters(...)`），而循环 Idle 动作
		// 每帧都在更新，眨眼因此被永久压制。这里挂在上游的 afterMotionUpdate 事件上
		// 手动推进同一个 eyeBlink 实例：该时机在动作更新之后、coreModel.update()
		// 之前，写入的 ParamEyeLOpen / ParamEyeROpen 会作用于当帧渲染。
		const internalModel = model.internalModel;
		let lastFrameTime = performance.now();
		internalModel.on("afterMotionUpdate", () => {
			const now = performance.now();
			const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
			lastFrameTime = now;
			internalModel.eyeBlink?.updateParameters(internalModel.coreModel, dt);
		});

		layoutModel(model, stage, host);

		// 动作推进不能靠 pixi-live2d-display 的默认方式：它把帧回调挂在 Ticker.shared 上，
		// 而本页没人驱动共享 Ticker，deltaTime 永远不涨 —— 模型能渲染但停在一帧
		// （症状：ParamBreath 恒定、motionManager.currentMotion 永远是 null）。
		// 这里关掉 autoUpdate，改用 Application 自己的 Ticker 手动推进（deltaMS 正是上游要的毫秒）。
		// 只有站点显式要求时才为「减少动效」冻结：小人由访客点击后才加载，属于主动发起的动效。
		model.autoUpdate = false;
		const frozenForReducedMotion =
			host.dataset.live2dPauseOnReduced === "true" && prefersReducedMotion();
		if (!frozenForReducedMotion) {
			// deltaMS 在后台标签页恢复后可能很大，卡一个上限避免动作瞬移
			app.ticker.add(() => model.update(Math.min(app.ticker.deltaMS, 100)));
		}

		const expressionManager =
			model.internalModel.motionManager.expressionManager;
		const names = (expressionManager?.definitions ?? [])
			.map((definition) => definition.Name)
			.filter((name): name is string => Boolean(name));
		let lastIndex = -1;

		const switchExpression = (): void => {
			if (names.length === 0) return;
			let index = Math.floor(Math.random() * names.length);
			if (names.length > 1 && index === lastIndex) {
				index = (index + 1) % names.length;
			}
			lastIndex = index;
			host.dataset.live2dExpression = names[index];
			void model.expression(names[index]);
		};

		const canvas = app.view as HTMLCanvasElement;
		const hint = host.dataset.live2dHint;
		if (hint) canvas.title = hint;
		const onCanvasClick = (): void => switchExpression();
		canvas.addEventListener("click", onCanvasClick);
		const onResize = (): void => layoutModel(model, stage, host);
		window.addEventListener("resize", onResize, { passive: true });

		// 视线跟随：focusController 只吃方向分量，因此不能靠上游的 model.focus() 缩放
		// （它内部已归一化成单位向量，乘系数会被抵消）。这里照搬它的坐标换算，
		// 再把方向分量乘 FOCUS_GAIN 来收窄转头幅度。
		const focusPoint = new PIXI.Point();
		const focusTo = (clientX: number, clientY: number): void => {
			const rect = canvas.getBoundingClientRect();
			focusPoint.set(clientX - rect.left, clientY - rect.top);
			model.toModelPosition(focusPoint, focusPoint, true);
			const { originalWidth, originalHeight, focusController } =
				model.internalModel;
			const tx = (focusPoint.x / originalWidth) * 2 - 1;
			const ty = (focusPoint.y / originalHeight) * 2 - 1;
			const radian = Math.atan2(ty, tx);
			focusController.focus(
				Math.cos(radian) * FOCUS_GAIN,
				-Math.sin(radian) * FOCUS_GAIN,
			);
		};
		let focusFrame = 0;
		const onPointerMove = (event: PointerEvent): void => {
			if (focusFrame) return;
			focusFrame = requestAnimationFrame(() => {
				focusFrame = 0;
				focusTo(event.clientX, event.clientY);
			});
		};
		const onPointerLeave = (): void => {
			model.internalModel.focusController.focus(0, 0);
		};
		window.addEventListener("pointermove", onPointerMove, { passive: true });
		document.addEventListener("pointerleave", onPointerLeave);
		const cancelFocus = (): void => {
			window.removeEventListener("pointermove", onPointerMove);
			document.removeEventListener("pointerleave", onPointerLeave);
			if (focusFrame) cancelAnimationFrame(focusFrame);
		};

		controllers.set(host, {
			app,
			stage,
			canvas,
			onCanvasClick,
			onResize,
			cancelFocus,
		});
		window.__shironeLive2D = { app, model, switchExpression };
		host.dataset.live2dMounted = "true";
	} catch (error) {
		host.dataset.live2dMounted = "error";
		console.error("[Shirone Live2D] 桌宠挂载失败：", error);
	} finally {
		if (spinner) void unmount(spinner);
	}
}

/** 卸载桌宠（收起态）：拆掉渲染器与 canvas，回到零成本状态。 */
export function unmountLive2DPet(host: HTMLElement): void {
	const controller = controllers.get(host);
	if (!controller) return;
	controllers.delete(host);
	disposeController(host, controller);
}
