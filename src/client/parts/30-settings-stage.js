//! 30-settings-stage：STAGE_CSS 收尾 + 设置面板 + 启用状态存储 + 舞台创建。
//! 内容：STAGE_CSS 的 .trim() 收尾、SETTINGS_CSS 模板（到 .trim()）、
//!       readEnabled/enabledStore、createStage/findRoot/ensureStage/
//!       hasAcceleratedWebGL、MaidCompanionsSetting 组件。
//! 依赖：STAGE_CSS（20-24 块）；被 40-lifecycle-exports 的 apply() 调用。
	background-color: var(--mc-fill-float) !important;
	border-radius: 28px !important;
	box-shadow:
		0 0 0 0.5px var(--mc-hairline),
		0 4px 16px rgba(0, 0, 0, 0.12),
		inset 0 0 var(--mc-glow-blur) var(--mc-glow-spread) rgba(var(--mc-glow-rgb), var(--mc-glow-alpha)) !important;
}
@media (prefers-reduced-transparency: reduce) {
	body[${GLASS_ATTR}] :is([data-mc-glass], [role='menu'], [role='dialog'][aria-modal='true']) {
		background-color: color-mix(in srgb, var(--dsw-alias-bg-base, #2c2c2e) 92%, transparent);
	}
}
`.trim();

		// 设置行/开关样式：**逐条对齐宿主**（v0.2.35）。
		// 出处：app.asar → @deepseek-ai/dsh-web-frontend/dist/assets/index-*.css
		//   行容器  ._field_bjqpo_3   {display:flex;flex-direction:column;gap:6px;padding:12px 0}
		//            ._field_bjqpo_3   {border-top:.5px solid var(--dsw-alias-border-l2)}
		//            ._head_bjqpo_14   {display:flex;align-items:center;gap:8px}
		//            ._label_bjqpo_20  {flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;
		//                               color:var(--dsw-alias-label-primary)}
		//            ._help_bjqpo_41   {padding:10px 0 0;font-size:12px;line-height:1.6;
		//                               color:var(--dsw-alias-label-secondary)}
		//   开关    ._switch_1ik0f_5{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;
		//                               height:20px;padding:2px;border:0;border-radius:999px;
		//                               corner-shape:round;background:var(--dsw-alias-border-l3)}
		//            [aria-checked=true]{background:var(--dsw-alias-brand-primary)}
		//            :disabled{cursor:default;opacity:.5}
		//            :focus-visible{outline:var(--dsw-focus-ring-width) solid
		//                           var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));
		//                           outline-offset:2px}
		//   圆钮    ._thumb_1ik0f_33{display:block;width:16px;height:16px;border-radius:50%;
		//                               corner-shape:round;
		//                               background:var(--dsw-alias-label-primary-foreground);
		//                               transition:transform .12s ease}
		//            [aria-checked=false] .thumb{background:var(--dsw-alias-switch-thumb)}
		//            [aria-checked=true]  .thumb{transform:translate(16px)}
		// 颜色全部走宿主 token，因此**浅色/深色自动跟随**，不写死任何色值：
		//   开＝brand-primary 底 + label-primary-foreground 钮（浅色＝黑底白钮，深色＝白底黑钮）
		//   关＝border-l3 底 + switch-thumb 钮（浅色＝黑 12% 底 + 近白钮，深色＝白 16% 底 + 中灰钮）
		// 每个 var() 都带同语义的兜底值，token 缺失时外观仍然正确。
		// 状态一律用 aria-checked 属性驱动（宿主同款），不再依赖 .is-on 类，
		// 也不再输出「启用/停用」文字——宿主行右侧只有开关本身。
		const SETTINGS_CSS = `
.mc-setting-field{display:flex;flex-direction:column;gap:4px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2,rgba(121,126,145,.18))}
.mc-setting-head{display:flex;align-items:center;gap:8px}
.mc-setting-label{flex:1;min-width:0;font-size:14px;font-weight:400;line-height:20px;color:var(--dsw-alias-label-primary,#15171b)}
.mc-setting-help{margin-top:0;padding:0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,#686c75)}
.mc-setting-switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:999px;corner-shape:round;background:var(--dsw-alias-border-l3,rgba(0,0,0,.12));cursor:pointer}
.mc-setting-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary,#15171b)}
.mc-setting-switch:disabled{cursor:default;opacity:.5}
.mc-setting-switch:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4f73ff));outline-offset:2px}
.mc-setting-switch-thumb{display:block;width:16px;height:16px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-primary-foreground,#fff);transition:transform .12s ease}
.mc-setting-switch[aria-checked="false"] .mc-setting-switch-thumb{background:var(--dsw-alias-switch-thumb,#fff)}
.mc-setting-switch[aria-checked="true"] .mc-setting-switch-thumb{transform:translate(16px)}
`.trim();

		// ── 开关偏好（localStorage，默认开启）──────────────────────────────
		function readEnabled() {
			try { return window.localStorage.getItem(STORAGE_KEY) !== "false"; } catch { return true; }
		}
		let enabledPref = readEnabled();
		const enabledListeners = new Set();
		const enabledStore = {
			getSnapshot: () => enabledPref,
			subscribe: (listener) => { enabledListeners.add(listener); return () => enabledListeners.delete(listener); },
			set: (enabled, persist = true) => {
				if (enabledPref === enabled) return;
				enabledPref = enabled;
				if (persist) { try { window.localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { } }
				for (const l of enabledListeners) l();
			},
		};

		function createFeatureStore(storageKey) {
			let value = true;
			try { value = window.localStorage.getItem(storageKey) !== "false"; } catch { }
			const listeners = new Set();
			return {
				getSnapshot: () => value,
				subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
				set: (next, persist = true) => {
					if (value === next) return;
					value = next;
					if (persist) { try { window.localStorage.setItem(storageKey, String(next)); } catch { } }
					for (const listener of listeners) listener();
				},
			};
		}
		const portraitStore = createFeatureStore("maid-companions.portrait");
		const glassStore = createFeatureStore("maid-companions.glass");

		// ── 角色舞台 ──────────────────────────────────────────────────────
		function createStage() {
			const stage = document.createElement("div");
			stage.dataset.dshMaidCompanionStage = "";
			stage.setAttribute("aria-hidden", "true");
			const left = document.createElement("img");
			left.dataset.dshMaidCompanionCharacter = "left";
			left.alt = "";
			left.src = MAID_LEFT;
			const right = document.createElement("img");
			right.dataset.dshMaidCompanionCharacter = "right";
			right.alt = "";
			right.src = MAID_RIGHT;
			stage.append(left, right);
			return stage;
		}
		function findRoot() {
			// 用持久对话列（centerCol / data-pane=conversation）作为舞台宿主：
			// 跨会话/跨阶段不卸载，保证动画对象稳定、620ms 高度过渡能驱动，
			// 并与 maid-atelier 的做法一致。列背景已转透明，立绘能透出。
			return document.querySelector(ROOT_SELECTOR);
		}
		function ensureStage(stage) {
			const root = findRoot();
			if (!root) return false;
			if (stage.parentElement !== root) root.prepend(stage);
			return true;
		}
		function hasAcceleratedWebGL() {
			if (typeof WebGLRenderingContext === "undefined") return false;
			const canvas = document.createElement("canvas");
			for (const kind of ["webgl2", "webgl"]) {
				try {
					const ctx = canvas.getContext(kind, { failIfMajorPerformanceCaveat: true });
					if (ctx !== null) { ctx.getExtension("WEBGL_lose_context")?.loseContext(); return true; }
				} catch { }
			}
			return false;
		}

		// ── 设置开关（React，结构与样式对齐宿主 SettingsField + Switch）──────
		// 宿主结构：field > (head > label + switch) + help
		function MaidCompanionsSwitchRow({ label, help, store }) {
			const enabled = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
			return React.createElement("div", { className: "mc-setting-field" },
				React.createElement("div", { className: "mc-setting-head" },
					React.createElement("div", { className: "mc-setting-label" }, label),
					React.createElement("button", {
						type: "button", role: "switch",
						"aria-label": label,
						"aria-checked": String(enabled),
						className: "mc-setting-switch",
						onClick: () => store.set(!enabled),
					}, React.createElement("span", { className: "mc-setting-switch-thumb", "aria-hidden": "true" }))),
				help && React.createElement("div", { className: "mc-setting-help" }, help));
		}
		function MaidCompanionsSetting() {
			return React.createElement(React.Fragment, null,
				React.createElement(MaidCompanionsSwitchRow, {
					label: "左右鲸鱼娘女仆",
					help: "控制鲸鱼娘女仆立绘和输入框液态玻璃效果的总开关",
					store: enabledStore,
				}),
				React.createElement(MaidCompanionsSwitchRow, { label: "显示女仆立绘", store: portraitStore }),
				React.createElement(MaidCompanionsSwitchRow, { label: "液态玻璃效果", store: glassStore }));
		}

		// ── Liquid Glass：对话输入框的液态玻璃折射（实验性）─────────────────
		// 复刻 Apple Liquid Glass 的"边缘透镜"：玻璃边缘会把背后的光**折射**进来。
		// 实现路径（参考 D:\下载\index.html 的纯 CSS+SVG 方案，无第三方依赖）：
		//   ① 取输入框的圆角矩形，算有符号距离场 SDF；
		//   ② 越靠近边缘的像素生成越大的、指向中心的位移（透镜边缘压缩），
		//      编码成位图：R 通道 → X 位移，G 通道 → Y 位移，128 表示零位移；
		//   ③ <feImage> 载入该位图 + <feDisplacementMap> 做实时扭曲；
		//   ④ 通过 backdrop-filter: url(#id) blur() saturate() 作用于元素**背后的内容**。
		//
		// 安全策略（对抗式设计）：整段全程 try/catch；不支持 backdrop-filter:url() 或
		// 处于软件渲染(low-power)时**直接不装**。于是任何失败都只是"没有折射"，
