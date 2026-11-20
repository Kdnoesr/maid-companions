# 输入框模糊参数回归修复

用户否决 v0.16 的浮层 blur8 / 设置 blur10；这些不是输入框标准。
本次只改 MAT.glass.blurPx 与 MAT.panel.blurPx，直接引用 LIQUID.blurPx (=1)。saturate1 / brightness1.05、窄边17、现有底色及其他区域保持。大面板 host 明确 backdrop-filter:none!important，滤镜只留在兄弟 veil，防止继承宿主滤镜重复采样。

修改前备份：D:/dsh-src/maid-companions-backups/PRE-RESTORE-COMPOSER-20261114（src、client.js、package.json）。
回归检查：D:/DSH Workspace/_lg27/check-recipe-regression.cjs，修复前8!==1，修复后PASS。node --check 与 assemble --check通过。
当前产物 SHA256 e5b2d434fcefb17cea85998a8309bf8461c2df281963632c2d42bd1bf06dfbb9。

未完成真实桌面视觉验收：8791桥原先未运行，临时启动后renderer无响应；没有重启Desktop、没有刷新、没有宣称运行时已验收。设置额外细环、底色、宿主遮罩本次均未进一步改动。旧文档v016的8/10参数不再是当前标准。
