# src/client/parts — lib/client.js 字节等同拆分区

## 状态

- 目标文件：lib/client.js（1,111,154 B，sha256 e5a735ac725b611dd20ec5c65157dbc42007824858511da9ea7eac034c4391fa）
- parts：14 个文件；每个文件顶部 4–8 行中文 //! 头注释，拼接前会被剥除。
- 验收：node scripts/assemble-client.mjs --check → RESULT: byte-identical。
- 本阶段只做“等价搬运”：所有 payload 都是从 lib/client.js 原样切出的字节，没有重写、重排、改名。
  语义重构（createLiquidGlass 拆模块、GlassHost 解耦）尚未开始，见文末 TODO。

## 三条命令

1) 只校验（CI/交付前必跑）：
   node scripts/assemble-client.mjs --check
2) 从 parts 覆盖生成 lib/client.js（先写 .tmp 再 rename，失败不落盘）：
   node scripts/assemble-client.mjs
3) lib/client.js 有预期内改动、需要重建 parts 时：
   node scripts/split-client.mjs --dry-run   # 先看有没有 payload 变化、切点是否仍自然
   node scripts/split-client.mjs             # 按 manifest 行区间重建并刷新 sha256

## 规则

- 禁止手改 parts 里的 payload：assemble 会逐段比对 manifest 的 payloadBytes / payloadSha256，
  不一致直接报错退出（exit 2）。
- 两个资产文件（10-/11-）标记 asset=true：允许 >60 KB，但内容只允许通过 scripts/inject-images.mjs
  重新注入；不要手工编辑 base64。
- 其余 part 必须 ≤60 KB（assemble 会检查，超限报错）。
- 头注释必须是 3–8 行且以 //! 开头；split-client 会按 manifest.header 重写。
- lib/client.js 漂移（sha256 与 manifest.targetSha256 不同）时：先确认改动的意图，
  再跑 split-client 重建；若要回滚则 git checkout -- lib/client.js。
- 交付产物不含 dev harness：90-dev-harness.js 在发布前必须剥离（v09/scripts/check_artifact.mjs
  默认拒绝 harness，--allow-harness 才放行）。

## part 清单（行号对应上面 sha256 的版本）

| # | 文件 | 行区间 | payload | 职责 |
|---|------|--------|---------|------|
| 1 | 00-preamble.js | L1-139 | 11,788 B | __ModuleLoader__ 外壳、banner、require、模块级常量 |
| 2 | 10-asset-maid-left.js | L140 | 381,679 B | 左立绘 base64（资产，勿手改） |
| 3 | 11-asset-maid-right.js | L141 | 529,496 B | 右立绘 base64（资产，勿手改） |
| 4 | 20-css-stage-base.js | L142-458 | 22,173 B | STAGE_CSS 1/5：舞台骨架 + 对话区毛玻璃 |
| 5 | 21-css-composer.js | L459-566 | 8,060 B | STAGE_CSS 2/5：输入框区域几何 |
| 6 | 22-css-floating.js | L567-884 | 20,765 B | STAGE_CSS 3/5：浮层/菜单/弹窗/气泡/面板/scrim |
| 7 | 23-css-controls.js | L885-1094 | 13,206 B | STAGE_CSS 4/5：v0.4.9 控件材质 |
| 8 | 24-css-tokens-legacy.js | L1095-1245 | 10,291 B | STAGE_CSS 5/5：::before 静音、页面级玻璃、收尾 |
| 9 | 30-settings-stage.js | L1246-1387 | 9,419 B | STAGE_CSS 收尾、SETTINGS_CSS、enabledStore、createStage、设置组件 |
| 10 | 31-material-constants.js | L1388-1535 | 12,308 B | 材质参数表：LIQUID / MAT / 选择器 / 预算闸门 |
| 11 | 32-material-engine-core.js | L1536-2364 | 51,866 B | createLiquidGlass 前半：数学、buildMap、collectTargets、mount、installRim |
| 12 | 33-engine-rim-apply.js | L2365-2734 | 21,985 B | 后半：installRing（死代码）、applyTo、rebuildAll、sync |
| 13 | 40-lifecycle-exports.js | L2735-2913 | 8,691 B | apply(ctx)、exports、module.exports 收尾 |
| 14 | 90-dev-harness.js | L2914-3089 | 9,427 B | 开发 harness（发布前剥离） |

## TODO：下一阶段才做的语义模块化（本轮未做）

以下是把当前“字节切片”升级为“可维护模块”的目标；行号基于上面 sha256 的版本，目标漂移后需同步更新。

| 目标模块 | 现位置（行） | 职责 | 备注 |
|----------|--------------|------|------|
| material/params.ts | 1388-1535 | LIQUID / MAT / 闸门常量，唯一调参入口 | 先做成 ESM 导出，保持数值逐字节一致 |
| material/math.ts | 1537-1621 | clamp/smoothStep/glassParams/surfaceKind/roundedRectSDF | 纯函数，可直接单测 |
| material/map.ts | 1605-1758 | MAP_MAX_EDGE、mapCache、buildMap（SDF→feImage 位移贴图） | 含 enc/scale 公式，迁出时勿改数值 |
| material/targets.ts | 1768-1893 | collectTargets 选择器与面积闸门 | 依赖 31 的 LIQUID_SELECTOR/MAX_AREA |
| material/dom-style.ts | 1894-1913 | writeStyle/restoreStyle 样式快照 | 与宿主样式隔离相关 |
| material/mount.ts | 1914-2004 | mount / removeRing：SVG filter 与 feImage 挂载 | 生命周期入口 |
| material/rim.ts | 2005-2295 | RIM_*/VEIL_* 常量、decorateCards、installRim、removeRim | 大面板 veil 分支 |
| material/before.ts | 2296-2364 | clearMaterial、hasBeforeGlass、muteBefore、restoreBefore、unmount | ::before 静音 |
| material/apply.ts | 2462-2633 | applyTo：单元素材质应用（backdrop-filter + 阴影 + 半径） | 需 GlassHost 注入回调，去掉对闭包的隐式依赖 |
| material/sync.ts | 2634-2734 | rebuildAll / mountNew / schedule / sync | MutationObserver + timer 收敛 |
| lifecycle/apply.ts | 2735-2913 | 插件 apply(ctx)、可见性、composer 动效、exports | 与宿主 loader 契约 |
| dead-code/installRing | 2365-2461 | 已废弃的镜像墙/环带实现 | 语义重构时删除，但要单独 commit 以便回滚 |
| build/strip-harness | 2914-3089 | 发布前剥离 dev harness | 建议在 tsdown 构建管线里做，不靠手工 |

### 升级顺序建议（风险从低到高）

1. material/params + material/math + material/map：纯函数/常量，先加单测再迁。
2. material/rim + before + targets：只搬运，不改选择器与数值；用 dump_surfaces 做 DOM 0-diff。
3. material/apply + sync + GlassHost：唯一需要改结构的一步，applyTo 与 installRim 通过显式 host 解耦。
4. lifecycle/apply 与 exports：最后动，保证 loader 契约不变。
5. 删除 installRing 死代码、剥离 harness：单独 commit。

### 升级期的验收

- node scripts/assemble-client.mjs --check 仍 byte-identical（在模块化产物替换前，用旧产物做对照）。
- node --check lib/client.js 通过。
- v09/scripts/dump_surfaces.js 前后 dump 与 baseline.dump.json 0 diff（容差 0.02）。
- 真机：composer 材质、设置窗、菜单、气泡四类表面截图对照，无可见变化。

## 历史

- v0.9 方案稿：team/a02-composer/v09/split-plan.md（27 文件大重构方案，已被本轮“字节等同抽离”路线取代）。
- 本轮执行记录与验收输出：team/a02-composer/v09/STATUS.md、team/a02-composer/v09/assemble-check.log。