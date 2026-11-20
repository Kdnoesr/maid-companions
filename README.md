# 左右鲸鱼娘女仆

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md)

[![npm](https://img.shields.io/npm/v/@kdnoesr/maid-companions?label=npm)](https://www.npmjs.com/package/@kdnoesr/maid-companions)

为 DeepSeek Harness（DSH）的对话区添加左右女仆立绘，并为输入框和部分浮层提供液态玻璃效果。

## 安装

在 DSH 侧栏打开「插件 → 添加插件」，粘贴以下包名。安装后重启 DSH。

```text
@kdnoesr/maid-companions
```

```sh
dsh plugin --profile desktop add '@kdnoesr/maid-companions'
```

GitHub 主分支提供预览版。在同一个安装框粘贴 `github:Kdnoesr/maid-companions#main` 即可体验独立开关。npm `0.6.0` 仍使用总开关。

## 设置

在「设置 → 通用 → 左右鲸鱼娘女仆」中，分别切换「显示女仆立绘」和「液态玻璃效果」。两项默认开启，偏好分别保存。总开关关闭时会暂停两项效果，重新开启后恢复各自的选择。

## 兼容性与排查

包清单声明 DSH `>=0.2.0-rc.2 <0.3.0`。折射取决于浏览器的滤镜支持和硬件加速。如果滚动不顺畅，可以单独关闭液态玻璃。请在同一个 profile 中只启用本插件或 `maid-atelier` 皮肤的其中一个。

## 开发

编辑 [源码分片](src/client/parts/README.md)，然后重新生成客户端产物。技术细节见 [液态玻璃](docs/liquid-glass.md) 和 [浮层覆盖范围](docs/overlay-surfaces.md)。

```sh
node scripts/rebuild-parts.mjs
node scripts/assemble-client.mjs --check
```

## 许可与署名

本插件的**代码**与**美术资源**适用**不同**许可：

| 部分 | 许可 |
| --- | --- |
| 代码（`lib/` 中的 JS/CSS、`src/`、`cordis.patch.yml`、`scripts/`、`docs/`） | **BSD-3-Clause** |
| 鲸鱼娘女仆立绘（内嵌于 `lib/client.js`） | **CC BY-NC-SA 4.0** |

### ⚠️ 美术资源：禁止商业性使用

立绘来自 [dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) 的
`maid-atelier` 皮肤，适用 **CC BY-NC-SA 4.0**（署名—**非商业性使用**—相同方式共享）。
**不得将本插件的立绘用于任何商业用途。**

即使美术资源被内嵌进源码、CSS、data URL 或 `lib/`，其许可**不改变**。

### 署名链（必须完整保留）

1. **上善** —— 鲸鱼娘角色形象原作者
   · [Pixiv](https://www.pixiv.net/users/62155430) · [Bilibili](https://b23.tv/8h5L4xz)
2. **ZipZipPipe** —— 加入 DeepSeek 元素的女仆鲸鱼娘二次设计（GPT Image 2）
   · [Pixiv](https://www.pixiv.net/users/18604994) · [Bilibili](https://b23.tv/Pnw6nG8)
3. **Small-tailqwq** —— [dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) / maid-atelier 皮肤

许可正文见 [LICENSE](LICENSE)（代码）与 [LICENSE-ARTWORK](LICENSE-ARTWORK)（美术），
完整署名链与复用要求见 [NOTICE](NOTICE)。

> 反馈与问题请在本仓库的 issue 中提出，**不要**去联系上面两位老师。

---

本插件为**非官方**第三方插件，与 DeepSeek / DeepSeek Harness 官方无关。
