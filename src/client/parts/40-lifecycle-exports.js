//! 40-lifecycle-exports：插件生命周期入口与 exports 赋值。
//! 内容：function apply(ctx)（插件装配、可见性同步、composer 动效、设置项注册、
//!       事件订阅）、exports.apply/inject 赋值、return module.exports 与外壳收尾。
//! 依赖：30-settings-stage、32/33 材质引擎；被宿主 loader 在激活插件时调用。
//! 注意：导出名与赋值是 loader 契约，勿增删。
				uninstall() {
					try {
						if (bubbleObserver) bubbleObserver.disconnect();
						bubbleObserver = null; observedBubbles.clear(); liveBubbles.clear();
						if (ro !== null) ro.disconnect();
						if (themeObs !== null) { themeObs.disconnect(); themeObs = null; }
						if (timer !== null) clearTimeout(timer);
						if (resizeTimer !== null) clearTimeout(resizeTimer);
						resizeTimer = null; dirtySizes.clear();
						for (const el of Array.from(instances.keys())) unmount(el);
					} catch { /* 忽略 */ } finally {
						ro = null; timer = null; instances.clear(); installed = false;
					}
				},
			};
		}
		function apply(ctx) {
			const body = document.body;

			// 样式表（随插件生命周期移除）
			ctx.effect(() => {
				const style = document.createElement("style");
				style.dataset.plugin = PLUGIN_ID;
				style.textContent = STAGE_CSS + "\n" + SETTINGS_CSS;
				document.head.appendChild(style);
				return () => style.remove();
			}, "maid-companions: styles");

			// ── Liquid Glass（输入框液态玻璃折射）─────────────────────────
			// 独立 effect：与插件生命周期绑定，卸载即回收滤镜、观察者与内联样式。
			const liquid = createLiquidGlass();
			try { globalThis.__mcDebug = () => liquid.debug(); } catch { /* ignore */ }
			ctx.effect(() => {
				if (enabledPref) liquid.install();
				return () => liquid.uninstall();
			}, "maid-companions: liquid glass");

			// ── 角色注入 ──────────────────────────────────────────────────
			const stage = createStage();
			let observer;
			let resizeTimer;
			let resizeHandler;

			let lastChatActive = false;
			const setChatActive = () => {
				// 空态/新会话 = hero（无 data-chat-flow 或 data-phase=hero）；有聊天 = active。
				// 用「是否有真实聊天内容」判定：空态(hero)→放大到 96%，进入会话(active)→缩小到 64%。
				const empty = document.querySelector("[data-phase='hero']") !== null
					|| document.querySelector("[data-phase='active'] [data-chat-flow]") === null;
				const active = !empty;
				if (active === lastChatActive) return;
				lastChatActive = active;
				// 边沿/差分 + 一帧强制切换：先断言相反值并强制 reflow，再置终态，
				// 保证 620ms 高度过渡总有 from→to 可插值；即使一次 commit 合并了
				// 中间往返（active→hero→active），属性也经历 有→无→有 的两帧切换，
				// 从而真正驱动过渡（对抗式审查不变量①④）。
				if (active) {
	