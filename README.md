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

GitHub 主分支与 npm 0.7.0 起都包含两个独立开关。如果机器访问 npm 镜像不稳定，也可以在同一个安装框粘贴下面的 Git 地址：

```text
github:Kdnoesr/maid-companions#main
```

### 从 0.6.0 或更早版本升级

0.6.0 的设置里只有一行总开关。直接覆盖安装有时会被 pnpm 回退成旧版本：镜像超时或解析失败时，新版没有装上，旧文件仍留在 profile 里，看起来就像“装过了”。先移除再安装即可：

```sh
dsh plugin --profile desktop remove @kdnoesr/maid-companions
dsh plugin --profile desktop add github:Kdnoesr/maid-companions#main
```

如果 add 报 ETIMEDOUT（npm 镜像访问不了），换官方源重试：

```sh
dsh plugin --profile desktop add @kdnoesr/maid-companions@0.7.0 --registry=https://registry.npmjs.org
```

装好后重启 DSH，设置里应出现三行：「左右鲸鱼娘女仆」「显示女仆立绘」「液态玻璃效果」。

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
