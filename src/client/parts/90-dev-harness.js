//! 90-dev-harness：本地调试 harness（LG27-HARNESS-BEGIN/END 包裹）。
//! 内容：window.__mcDev 调试桥、热重载与手工触发入口，仅供开发。
//! 依赖：前 12 块的导出；不放业务逻辑。
//! 发布：构建/交付前必须整段剥离（v09/scripts/check_artifact.mjs 会拒绝无 --allow-harness 的产物）。
				body.removeAttribute("data-dsh-maid-companion-chat-active");
					void body.offsetHeight;
					body.setAttribute("data-dsh-maid-companion-chat-active", "");
				} else {
					body.setAttribute("data-dsh-maid-companion-chat-active", "");
					void body.offsetHeight;
					body.removeAttribute("data-dsh-maid-companion-chat-active");
				}
			};
			// 立绘作为内容之下的常驻底层图层（像 PS 图层）：任何视图都显示，
			// 只是排在内容之后。舞台放入对话视图根内，根内内容设为 relative 盖在其上。
			const syncVisibility = () => {
				if (!enabledPref) return;
				body.setAttribute(OWNER_ATTR, "");
				ensureStage(stage);
			};

			// 照搬 maid-atelier 皮肤的 syncComposerMotion：按 data-phase hero↔active 翻转，
			// 置 body[data-dsh-maid-companion-motion=dock|rise]（560ms 后清除），驱动输入卡
			// 的 dock/rise 动画（即皮肤在会话切换时的签名动效）。
			let motionPhase;
			let motionTimer;
			const syncComposerMotion = () => {
				const root = document.querySelector("[data-phase='hero'], [data-phase='active']");
				const next = root?.dataset?.phase;
				if (next !== "hero" && next !== "active") return;
				if (motionPhase !== undefined && motionPhase !== next) {
					body.setAttribute("data-dsh-maid-companion-motion", next === "active" ? "dock" : "rise");
					if (motionTimer) clearTimeout(motionTimer);
					motionTimer = setTimeout(() => body.removeAttribute("data-dsh-maid-companion-motion"), 560);
				}
				motionPhase = next;
			};

			// ── 2026-10-26 · 修「设置窗卡死 / 永久骨架屏」──────────────
			// 自激回路：本插件自己会往 DOM 里插 4 根玻璃条 + 磨砂垫层 + <svg>滤镜，
			// 这些 childList 变动会被下面这个 observer 收到 → liquid.refresh()
			// → 120ms 后 sync() → rebuildAll() → applyTo() → installRim()
			// → 又插一遍条子/垫层 → 又被收到 …… 无限循环。
			// 每一轮还要重算 4 张 canvas 位移贴图，主线程被彻底占满，
			// 于是设置面板的内容（插件列表/模型页）永远画不出来，只剩骨架屏。
			// 判据：一条 childList 记录里增删的节点**全部是插件自己插的**时，不触发重建。
			const SVG_NS_URI = "http://www.w3.org/2000/svg";
			const OWN_ATTRS = ["data-mc-glass-rim", "data-mc-glass-rim-bar", "data-mc-glass-bed", "data-mc-glass-soft", "data-mc-glass-veil", "data-mc-glass-svg", "data-mc-frost"];
			const isOwnNode = (n) => {
				for (let el = n && (n.nodeType === 1 ? n : n.parentElement); el; el = el.parentElement) {
					for (const a of OWN_ATTRS) if (el.hasAttribute(a)) return true;
				}
				return false;
			};
			const onlyOwnMutations = (records) => {
				if (records.length === 0) return true;
				for (const r of records) {
					if (r.type !== "childList") return false;   // 属性变化照旧处理
					if (isOwnNode(r.target)) continue;
					let n = 0;
					for (const x of r.addedNodes) { n++; if (!isOwnNode(x)) return false; }
					for (const x of r.removedNodes) { n++; if (!isOwnNode(x)) return false; }
					if (n === 0) return false;
				}
				return true;
			};
			observer = new MutationObserver((records) => {
				if (!enabledPref) return;
				if (onlyOwnMutations(records)) return;   // 自己的 DOM 变动不触发重算
				if (portraitStore.getSnapshot()) {
					setChatActive();
					syncVisibility();
				}
				if (!glassStore.getSnapshot()) return;
				syncComposerMotion();
				// React 可能重建输入框节点（此时内联的 backdrop-filter 会丢），
				// 检查节点是否换了，换了就去抖地重新生成位移贴图并挂回。
				// Text-only changes inside the chat cannot add or replace a material surface.
				const onlyChatText = records.every((record) => {
					if (record.type !== "childList" || !record.target.closest?.(CHAT_SELECTOR)) return false;
					const changed = [...record.addedNodes, ...record.removedNodes];
					return changed.length > 0 && changed.every((node) => node.nodeType === 3);
				});
				if (!onlyChatText) liquid.refresh();
			});
			observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-chat-flow", "data-message-bubble", "data-phase", "aria-selected", "data-menu-material", "aria-hidden", "role", "class", "data-composer-card", "aria-modal", "data-context-menu", "data-document-zoom-controls", "data-quote-popover"] });

			resizeHandler = () => {
				if (!enabledPref || !portraitStore.getSnapshot()) return;
				body.setAttribute("data-dsh-maid-companion-resizing", "");
				if (resizeTimer) clearTimeout(resizeTimer);
				resizeTimer = setTimeout(() => body.removeAttribute("data-dsh-maid-companion-resizing"), 120);
			};
			window.addEventListener("resize", resizeHandler);
			if (!hasAcceleratedWebGL()) body.setAttribute("data-dsh-maid-companion-low-power", "");

			const reducedTransparency = window.matchMedia?.("(prefers-reduced-transparency: reduce)");
			const syncFeatures = () => {
				const portraits = enabledPref && portraitStore.getSnapshot();
				const glass = enabledPref && glassStore.getSnapshot() && !reducedTransparency?.matches;
				if (portraits) {
					syncVisibility();
					setChatActive();
				} else {
					stage.remove();
					body.removeAttribute(OWNER_ATTR);
					body.removeAttribute("data-dsh-maid-companion-chat-active");
					body.removeAttribute("data-dsh-maid-companion-resizing");
					clearTimeout(resizeTimer);
					lastChatActive = false;
				}
				const wasGlass = body.hasAttribute(GLASS_ATTR);
				body.toggleAttribute(GLASS_ATTR, glass);
				if (glass && !wasGlass) {
					syncComposerMotion();
					liquid.install();
				} else if (!glass && wasGlass) {
					liquid.uninstall();
					clearTimeout(motionTimer);
					motionTimer = undefined;
					motionPhase = undefined;
					body.removeAttribute("data-dsh-maid-companion-motion");
				}
			};
			const featureSubscriptions = [enabledStore, portraitStore, glassStore].map(store => store.subscribe(syncFeatures));
			reducedTransparency?.addEventListener?.("change", syncFeatures);
			syncFeatures();

			// ── 通用设置开关（React，样式与其它开关一致）──────────────────
			try {
				ctx.slots.inject("settings.general.item", () =>
					ctx.slots.register({ name: "settings.general.item", id: "maid-companions-enabled", order: 25 },
						MaidCompanionsSetting,
					));
			} catch (error) {
				console.error("[maid-companions] settings inject failed", error);
			}

			ctx.effect(() => () => {
				observer?.disconnect();
				if (resizeHandler) window.removeEventListener("resize", resizeHandler);
				if (resizeTimer) clearTimeout(resizeTimer);
				if (motionTimer) clearTimeout(motionTimer);
				reducedTransparency?.removeEventListener?.("change", syncFeatures);
				for (const unsubscribe of featureSubscriptions) unsubscribe();
				body.removeAttribute(GLASS_ATTR);
				stage.remove();
				body.removeAttribute(OWNER_ATTR);
				body.removeAttribute("data-dsh-maid-companion-chat-active");
				body.removeAttribute("data-dsh-maid-companion-resizing");
				body.removeAttribute("data-dsh-maid-companion-low-power");
				body.removeAttribute("data-dsh-maid-companion-motion");
			}, "maid-companions: teardown");
		}

		exports.apply = apply;
		exports.inject = ["slots"];
		return module.exports;
	}
});
/* ==LG27-HARNESS-BEGIN== (dev only, stripped before delivery) */
/* build-tag: v091b */
;(function () {
  var EP = 'http://127.0.0.1:8791';
  var RANK = 1794515277403;   // 单调递增注入序号：服务端只服务序号最大的那个实例
  var ME = { v: 3, rank: RANK, build: 'ce1c1a39da9e', boot: Date.now(), rev: 0, lastErr: null };
  if (window.__lg27h && window.__lg27h.build === ME.build) return;
  window.__lg27h = ME;
  function post(p, obj) {
    try {
      return fetch(EP + p, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(obj) }).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }
  function reply(id, obj) { post('/result', Object.assign({ id: id }, obj)); }
  function jget(p) { try { return fetch(EP + p, { cache: 'no-store' }).then(function (r) { return r.json(); }); } catch (e) { return Promise.resolve({ ok: false }); }
  }
  function who() { return (window.__lg27h && window.__lg27h.owner) || 'anon'; }
  function lockUi(ttl) {
    return jget('/lock?owner=' + encodeURIComponent(who()) + '&ttl=' + (ttl || 30000)).then(function (r) {
      return r && r.ok ? { ok: true } : { ok: false, error: 'UI busy: held by ' + ((r && r.holder) || '?') + ' until ' + new Date((r && r.until) || 0).toISOString() };
    });
  }
  function unlockUi() { return jget('/unlock?owner=' + encodeURIComponent(who())); }
  function serialize(o) {
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return String(o); }
  }
  var ACTIONS = {
    ping: function () {
      var f = null, ev = null;
      try { f = typeof new Function('return 1'); } catch (e) { f = 'err:' + e.message; }
      try { ev = typeof window.eval; } catch (e) { ev = 'err'; }
      return { ok: true, fn: f, evalType: ev, ua: navigator.userAgent, href: location.href, ready: document.readyState, boot: window.__lg27h.boot, hasCSP: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]') };
    },
    dom: function (a) {
      var root = a && a.selector ? document.querySelector(a.selector) : document.body;
      if (!root) return { ok: false, error: 'no selector ' + a.selector };
      var depth = (a && a.depth) || 4;
      function walk(el, d) {
        var o = { tag: el.tagName.toLowerCase(), cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '')).slice(0, 160), attrs: {}, rect: null, txt: null, kids: [] };
        for (var i = 0; i < el.attributes.length; i++) {
          var at = el.attributes[i];
          if (/^(role|aria-[a-z]+|data-[a-z0-9-]+|id|type|title|placeholder)$/.test(at.name)) o.attrs[at.name] = String(at.value).slice(0, 80);
        }
        var r = el.getBoundingClientRect();
        o.rect = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
        var own = '';
        for (var k = 0; k < el.childNodes.length; k++) if (el.childNodes[k].nodeType === 3) own += el.childNodes[k].textContent;
        own = own.trim();
        if (own) o.txt = own.slice(0, 100);
        if (d > 0) for (var j = 0; j < el.children.length && j < 400; j++) o.kids.push(walk(el.children[j], d - 1));
        return o;
      }
      return { ok: true, tree: walk(root, depth) };
    },
    styles: function (a) {
      var el = document.querySelector(a.selector);
      if (!el) return { ok: false, error: 'no selector' };
      var cs = getComputedStyle(el);
      var out = {};
      (a.props || ['background-color', 'backdrop-filter', '-webkit-backdrop-filter', 'box-shadow', 'border-radius', 'border', 'color', 'opacity', 'z-index', 'position', 'filter', 'mix-blend-mode']).forEach(function (p) { out[p] = cs.getPropertyValue(p); });
      var r = el.getBoundingClientRect();
      return { ok: true, rect: [r.x, r.y, r.width, r.height], styles: out, html: a.html ? el.outerHTML.slice(0, 4000) : undefined };
    },
    click: function (a) { return (a && a.noLock ? Promise.resolve({ ok: true }) : lockUi((a && a.ttl) || 30000)).then(function (lk) {
      if (!lk.ok) return lk;
      return ACTIONS.__click(a);
    }); },
    __click: function (a) {
      var el = document.querySelector(a.selector);
      if (!el) return { ok: false, error: 'no selector' };
      var r = el.getBoundingClientRect();
      var cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      var top = document.elementFromPoint(cx, cy);
      var opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 };
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) {
        var C = t.indexOf('pointer') === 0 && window.PointerEvent ? PointerEvent : MouseEvent;
        el.dispatchEvent(new C(t, opts));
      });
      return { ok: true, hit: top ? (top.tagName + '.' + String(top.className || '').slice(0, 60)) : null };
    },
    key: function (a) {
      var own = who();
      setTimeout(function () { if (a.key === 'Escape') unlockUi(); }, 30);
      var el = document.activeElement || document.body;
      var ev = { key: a.key, code: a.code || a.key, keyCode: a.keyCode || 0, which: a.keyCode || 0, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent('keydown', ev));
      el.dispatchEvent(new KeyboardEvent('keyup', ev));
      return { ok: true, active: el.tagName };
    },
    pattern: function (a) {
      // 受控背景测试图：整屏 canvas，供玻璃表面背后有高频纹理可折射/模糊。
      // kind: 'checker' 棋盘 | 'text' 文字行 | 'grid' 细网格 | 'radial' 同心圆
      var old = document.getElementById('__lg27_pattern');
      if (old) old.remove();
      var kind = (a && a.kind) || 'checker';
      var W = window.innerWidth, H = window.innerHeight;
      var cv = document.createElement('canvas');
      cv.id = '__lg27_pattern';
      cv.width = W; cv.height = H;
      cv.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;opacity:' + ((a && a.opacity) || 1) + ';';
      var g = cv.getContext('2d');
      g.fillStyle = '#0b0f18'; g.fillRect(0, 0, W, H);
      if (kind === 'checker') {
        var s = (a && a.cell) || 12;
        for (var y = 0; y < H; y += s) for (var x = 0; x < W; x += s) {
          if (((x / s) + (y / s)) % 2 === 0) { g.fillStyle = '#f2f6ff'; g.fillRect(x, y, s, s); }
        }
      } else if (kind === 'grid') {
        g.strokeStyle = 'rgba(210,230,255,0.85)'; g.lineWidth = 1;
        for (var i = 0; i <= W; i += 16) { g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, H); g.stroke(); }
        for (var j = 0; j <= H; j += 16) { g.beginPath(); g.moveTo(0, j + 0.5); g.lineTo(W, j + 0.5); g.stroke(); }
      } else if (kind === 'radial') {
        for (var r = 8; r < Math.max(W, H); r += 14) {
          g.strokeStyle = (r / 14) % 2 < 1 ? 'rgba(240,246,255,0.9)' : 'rgba(120,150,200,0.55)';
          g.lineWidth = 3; g.beginPath(); g.arc(W * 0.5, H * 0.5, r, 0, Math.PI * 2); g.stroke();
        }
      } else {
        g.fillStyle = '#eef4ff';
        g.font = '600 ' + ((a && a.size) || 28) + 'px system-ui, sans-serif';
        g.textBaseline = 'top';
        for (var line = 0; line * 46 < H; line++) {
          var txt = '';
          for (var w = 0; w < 26; w++) txt += String.fromCharCode(65 + ((line * 7 + w * 3) % 26));
          g.fillText(txt, 24, line * 46 + 8);
        }
      }
      document.body.appendChild(cv);
      return { ok: true, kind: kind, rect: [W, H] };
    },
    unpattern: function () {
      var el = document.getElementById('__lg27_pattern');
      if (el) el.remove();
      return { ok: true };
    },
    eval: function (a) {
      if (a.lock) { return lockUi(a.lockTtl || 60000).then(function (lk) { if (!lk.ok) return lk; return ACTIONS.__eval(a); }); }
      return ACTIONS.__eval(a);
    },
    __eval: function (a) {
      try {
        var fn = new Function('return (async () => {' + a.code + '})()');
        return Promise.resolve(fn()).then(function (v) { return { ok: true, value: serialize(v) }; }, function (e) { return { ok: false, error: String(e && e.stack || e) }; });
      } catch (e) { return { ok: false, error: 'csp/eval: ' + String(e && e.message || e) }; }
    }
  };
  // pointer/click helper for real-ish activation via CDP-less DOM events is often insufficient;
  // expose a raw element handle list instead for inspection.
  window.__lg27 = ACTIONS;
  async function loop() {
    if (window.__lg27h !== ME) return;   // 被同一 build 之外的实例接管 → 自行退出
    try {
      var r = await fetch(EP + '/poll?v=3&r=' + RANK, { cache: 'no-store' });
      var cmd = await r.json();
      if (cmd && cmd.action) {
        if (window.__lg27h) window.__lg27h.owner = cmd.owner || 'anon';
        var fn = ACTIONS[cmd.action];
        var out;
        if (!fn) out = { ok: false, error: 'unknown action ' + cmd.action };
        else {
          try { out = await fn(cmd.args || {}); } catch (e) { out = { ok: false, error: String(e && e.stack || e) }; }
        }
        out.action = cmd.action;
        out.owner = cmd.owner || null;
        out.t = Date.now();
        post('/result', { id: cmd.id, out: out });
      }
    } catch (e) { window.__lg27h.lastErr = String(e); }
    ME.rev++;
    setTimeout(loop, 250);
  }
  setTimeout(loop, 300);
  try { post('/log', { kind: 'boot', href: location.href, ts: Date.now() }); } catch (e) {}
})();
/* ==LG27-HARNESS-END== */
/* ==LG27-HARNESS-END== */
