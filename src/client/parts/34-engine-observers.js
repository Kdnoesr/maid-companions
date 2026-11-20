//! Visibility and resize observers, reconciliation, and engine lifecycle.
//! Continues the createLiquidGlass closure from part 33.
//! Part 40 finishes teardown and exports the client plugin.
			// Implicit-root IO accounts for clipping by the actual scroll ancestors.
			let bubbleObserver = null;
			const observedBubbles = new Set();
			const liveBubbles = new Set();
			const bubbleSelector = CHAT_SELECTOR + " [data-message-bubble]:not([data-composer-card], [data-menu-material], [role])";
			const discoverBubbles = () => {
				if (!bubbleObserver) return;
				const wanted = new Set(document.querySelectorAll(bubbleSelector));
				for (const el of observedBubbles) if (!wanted.has(el)) {
					bubbleObserver.unobserve(el);
					observedBubbles.delete(el);
					if (liveBubbles.delete(el)) unmount(el);
				}
				for (const el of wanted) if (!observedBubbles.has(el)) {
					observedBubbles.add(el);
					bubbleObserver.observe(el);
				}
			};
			const onBubbleIntersection = (entries, observer) => {
				if (observer !== bubbleObserver) return;
				for (const {target, isIntersecting, intersectionRect} of entries) {
					if (!observedBubbles.has(target)) continue;
					const eligible = target.isConnected && target.matches(bubbleSelector);
					if (!eligible) {
						observer.unobserve(target);
						observedBubbles.delete(target);
					}
					if (!eligible || !isIntersecting || intersectionRect.width <= 0 || intersectionRect.height <= 0) {
						if (liveBubbles.delete(target)) unmount(target);
					} else if (!instances.has(target)) {
						liveBubbles.add(target);
						applyTo(target, mount(target));
					}
				}
			};
			let resizeTimer = null;
			const dirtySizes = new Set();
			const onResize = (entries, observer) => {
				if (observer !== ro) return;
				for (const {target} of entries) if (instances.has(target)) dirtySizes.add(target);
				if (resizeTimer !== null || !dirtySizes.size) return;
				resizeTimer = setTimeout(() => {
					resizeTimer = null;
					for (const el of dirtySizes) {
						const inst = instances.get(el);
						if (inst && el.isConnected) applyTo(el, inst);
					}
					dirtySizes.clear();
				}, 120);
			};
			const rebuildAll = () => { for (const [el, inst] of instances) applyTo(el, inst); };
			const mountNew = () => {
				try {
					const wanted = collectTargets();
					discoverBubbles();
					const wantedSet = new Set([...wanted, ...liveBubbles]);
					for (const el of instances.keys()) if (!wantedSet.has(el)) unmount(el);
					for (const el of wanted) {
						if (!instances.has(el)) applyTo(el, mount(el));
					}
					// 已失效目标同步卸载，避免宿主复用节点时留下滤镜。
				} catch { /* 忽略 */ }
			};

			// 去抖调度：默认重建全部贴图；也可传入别的任务（如 sync）。
			// 单一定时器 = 同一时间窗内多次触发只跑最后一次，避免 DOM 频繁变动时反复重算。
			const schedule = (task, delay) => {
				if (timer !== null) clearTimeout(timer);
				timer = setTimeout(task ?? rebuildAll, delay ?? 120);
			};

			/** 让实例集合与当前 DOM 对齐：新增的挂上，消失的卸掉。 */
			const sync = () => {
				try {
					const wanted = collectTargets();
					for (const el of wanted) if (!instances.has(el)) mount(el);
					for (const el of Array.from(instances.keys())) if (wanted.indexOf(el) < 0 && !liveBubbles.has(el)) unmount(el);
					rebuildAll();
				} catch { /* 忽略 */ }
			};

			return {
				/** @returns {boolean} 是否真的启用了折射 */
				install() {
					try {
						if (installed) return true;
						if (!(typeof CSS !== "undefined" && CSS.supports && CSS.supports("backdrop-filter", "url(#x)"))) return false;
						if (document.body.hasAttribute("data-dsh-maid-companion-low-power") || !hasAcceleratedWebGL()) return false;
						ro = new ResizeObserver(onResize);
						// v0.4.6：主题切换（深浅）会让底色/内辉语义整体反转，
						// 而色彩是内联写死的 → 必须重算一遍。宿主切主题只改 body 属性，
						// 不会触发布局变化，ResizeObserver 收不到，故单独盯这个属性。
						try {
							themeObs = new MutationObserver(() => schedule(sync, 80));
							themeObs.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme", "data-ds-theme-source"] });
						} catch { themeObs = null; }
						if (typeof IntersectionObserver === "function") bubbleObserver = new IntersectionObserver(onBubbleIntersection, { threshold: [0, 0.00001] });
						discoverBubbles();
						sync();
						installed = true;
						return true;
					} catch { return false; }
				},
				/** React 重建节点 / 浮层开合时由外部 MutationObserver 调用。
				 *  ⚠️ 时序要求（用户反馈"打开设置窗会闪一下才变液态玻璃"）：
				 *  浮层刚插入 DOM 时，**必须尽快**挂上滤镜，否则会先以
				 *  CSS 回退外观（较实的毛玻璃）显示一两帧，再突变成液态玻璃。
				 *  所以这里分两步：
				 *    · 立刻（同步）只为"新出现的目标"建滤镜 —— 通常只有 1 个浮层，
				 *      且贴图已降采样到 ≤512，单次只要 1~3ms，不会造成掉帧；
				 *    · 失效目标立即卸载；尺寸与主题变化由各自的观察器调度。 */
				refresh() {
					try {
						if (ro === null) return;
						mountNew();
					} catch { /* 忽略 */ }
				},
				/** 开发期诊断：为什么某个元素没被接管（只读，不影响生产逻辑）。 */
				debug() {
					try {
						const wanted = collectTargets();
						const d = (el) => ({
							tag: el.tagName,
							cls: (typeof el.className === "string" ? el.className : "").slice(0, 40),
							role: el.getAttribute("role"),
							dm: el.getAttribute("data-menu-material"),
							trig: el.hasAttribute("data-trigger-menu"),
							kind: surfaceKind(el),
							area: el.offsetWidth * el.offsetHeight,
							mounted: instances.has(el),
						});
						return {
							ver: MC_VER,
							found: Array.prototype.slice.call(document.querySelectorAll(LIQUID_SELECTOR)).map(d),
							wanted: wanted.map(d),
							mounted: Array.from(instances.keys()).map(d),
						};
					} catch (e) { return { error: String(e && e.message || e) }; }
				},
