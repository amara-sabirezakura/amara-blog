import {
	MC_SPECS,
	MC_STYLES,
	type McSpec,
	type McStyle,
	resolveScheme,
} from "@utils/mc-utils";
import { getDefaultSpec, getDefaultStyle } from "@/config";

const STYLE_KEY = "mc-style";
const SPEC_KEY = "mc-spec";

/** CSS custom-property names emitted for each M3/M3E role. */
const ROLE_TO_CSS: Record<string, string> = {
	primary: "--mc-primary",
	onPrimary: "--mc-on-primary",
	primaryContainer: "--mc-primary-container",
	onPrimaryContainer: "--mc-on-primary-container",
	inversePrimary: "--mc-inverse-primary",
	primaryFixed: "--mc-primary-fixed",
	primaryFixedDim: "--mc-primary-fixed-dim",
	onPrimaryFixed: "--mc-on-primary-fixed",
	onPrimaryFixedVariant: "--mc-on-primary-fixed-variant",
	secondary: "--mc-secondary",
	onSecondary: "--mc-on-secondary",
	secondaryContainer: "--mc-secondary-container",
	onSecondaryContainer: "--mc-on-secondary-container",
	secondaryFixed: "--mc-secondary-fixed",
	secondaryFixedDim: "--mc-secondary-fixed-dim",
	onSecondaryFixed: "--mc-on-secondary-fixed",
	onSecondaryFixedVariant: "--mc-on-secondary-fixed-variant",
	tertiary: "--mc-tertiary",
	onTertiary: "--mc-on-tertiary",
	tertiaryContainer: "--mc-tertiary-container",
	onTertiaryContainer: "--mc-on-tertiary-container",
	tertiaryFixed: "--mc-tertiary-fixed",
	tertiaryFixedDim: "--mc-tertiary-fixed-dim",
	onTertiaryFixed: "--mc-on-tertiary-fixed",
	onTertiaryFixedVariant: "--mc-on-tertiary-fixed-variant",
	error: "--mc-error",
	onError: "--mc-on-error",
	errorContainer: "--mc-error-container",
	onErrorContainer: "--mc-on-error-container",
	surface: "--mc-surface",
	surfaceDim: "--mc-surface-dim",
	surfaceBright: "--mc-surface-bright",
	surfaceContainerLowest: "--mc-surface-container-lowest",
	surfaceContainerLow: "--mc-surface-container-low",
	surfaceContainer: "--mc-surface-container",
	surfaceContainerHigh: "--mc-surface-container-high",
	surfaceContainerHighest: "--mc-surface-container-highest",
	onSurface: "--mc-on-surface",
	surfaceVariant: "--mc-surface-variant",
	onSurfaceVariant: "--mc-on-surface-variant",
	outline: "--mc-outline",
	outlineVariant: "--mc-outline-variant",
	inverseSurface: "--mc-inverse-surface",
	inverseOnSurface: "--mc-inverse-on-surface",
	shadow: "--mc-shadow",
	scrim: "--mc-scrim",
	surfaceTint: "--mc-surface-tint",
	primaryDim: "--mc-primary-dim",
	secondaryDim: "--mc-secondary-dim",
	tertiaryDim: "--mc-tertiary-dim",
	errorDim: "--mc-error-dim",
};

export function isMcStyle(v: string): v is McStyle {
	return (MC_STYLES as readonly string[]).includes(v);
}

/**
 * 构建期解析：把 (hue, style, spec, isDark) 解析成「CSS 变量名 → 色值」映射。
 *
 * 与 `applyCurrentScheme()` 共用同一份 role → CSS 变量映射，但**不读 localStorage**，
 * 因此在 SSR / 构建期调用是安全的。用途是让 Layout 把默认风格的调色板交给首屏内联脚本，
 * 在首次绘制前就把配色落定，消除「先渲染默认色、再闪变」的 FOUC。
 */
export function resolveSchemeCssVars(
	hue: number,
	style: McStyle,
	spec: McSpec,
	isDark: boolean,
): Record<string, string> {
	const scheme = resolveScheme(hue, isDark, style, spec);
	const vars: Record<string, string> = {};
	for (const [role, cssVar] of Object.entries(ROLE_TO_CSS)) {
		const value = scheme[role];
		if (value) vars[cssVar] = value;
	}
	return vars;
}

export function isMcSpec(v: string): v is McSpec {
	return (MC_SPECS as readonly string[]).includes(v);
}

export function getStyle(): McStyle {
	const stored = localStorage.getItem(STYLE_KEY);
	return stored && isMcStyle(stored) ? stored : (getDefaultStyle() as McStyle);
}

export function getSpec(): McSpec {
	const stored = localStorage.getItem(SPEC_KEY);
	return stored && isMcSpec(stored) ? stored : (getDefaultSpec() as McSpec);
}

export function setStyle(style: McStyle): void {
	localStorage.setItem(STYLE_KEY, style);
	applyCurrentScheme();
}

export function setSpec(spec: McSpec): void {
	localStorage.setItem(SPEC_KEY, spec);
	applyCurrentScheme();
}

/**
 * Recompute and apply the dynamic M3/M3E scheme for the current hue, style,
 * spec and light/dark mode, writing concrete hex values onto CSS custom
 * properties on `:root`.
 */
export function applyCurrentScheme(): void {
	const root = document.querySelector(":root") as HTMLElement | null;
	if (!root) return;

	const hue = Number.parseInt(
		root.style.getPropertyValue("--hue") || "250",
		10,
	);
	const isDark = root.classList.contains("dark");
	const style = getStyle();
	const spec = getSpec();
	const scheme = resolveScheme(hue, isDark, style, spec);

	for (const [role, cssVar] of Object.entries(ROLE_TO_CSS)) {
		const value = scheme[role];
		if (value) {
			root.style.setProperty(cssVar, value);
		} else {
			root.style.removeProperty(cssVar);
		}
	}
}
