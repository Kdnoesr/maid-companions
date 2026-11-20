# Turn navigator 右侧摘要卡修复

目标：只修 `[role=tooltip][style*="--turn-preview-center"]`，即 DSH 对话右侧刻度悬停的本轮摘要卡；不改变其他浮层。

修复内容：
- 恢复 LIQUID_SELECTOR 的 `[role=menu]` 条目（此前一次误编辑已恢复）。
- 将 turn preview 识别为 composer-style direct surface：transparent background、backdrop-filter `blur(1px) saturate(1) brightness(1.05)`、同源 0.5px hairline 与 20/-5/.20 内辉；保留宿主定位、尺寸、padding、文本布局。
- 通过稳定的 inline custom property `--turn-preview-center` 定位，不依赖哈希 CSS module 类名。

构建：node --check、assemble --check、composer material regression 均通过。
产物：lib/client.js 1,132,744 B，SHA256 `10f0636e69acf951db1a16d88376f3455752420f633850f595d86eea1806368a`。
备份：PRE-TURN-PREVIEW-20261115。

真实桌面 HMR/截图尚未完成；没有重启 Desktop 或刷新。