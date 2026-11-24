# 左右鯨魚娘女僕

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md)

[![npm](https://img.shields.io/npm/v/@kdnoesr/maid-companions?label=npm)](https://www.npmjs.com/package/@kdnoesr/maid-companions)

為 DeepSeek Harness（DSH）的對話區加入左右女僕立繪，並為輸入框和部分浮層提供液態玻璃效果。

## 安裝

在 DSH 側欄開啟「外掛 → 新增外掛」，貼上下方的套件名稱。安裝後重新啟動 DSH。

```text
@kdnoesr/maid-companions
```

```sh
dsh plugin --profile desktop add '@kdnoesr/maid-companions'
```

GitHub 主分支與 npm 0.7.0 起都包含兩個獨立開關。若機器連線 npm 鏡像不穩定，也可以在同一個安裝欄位貼上下方的 Git 位址：

```text
github:Kdnoesr/maid-companions#main
```

### 從 0.6.0 或更早版本升級

0.6.0 的設定只有一行總開關。直接覆蓋安裝有時會被 pnpm 退回舊版本：鏡像逾時或解析失敗時，新版沒裝上，舊檔案仍留在 profile 裡，看起來就像「已經裝過了」。先移除再安裝即可：

```sh
dsh plugin --profile desktop remove @kdnoesr/maid-companions
dsh plugin --profile desktop add github:Kdnoesr/maid-companions#main
```

若 add 回報 ETIMEDOUT（無法連上 npm 鏡像），改用官方來源重試：

```sh
dsh plugin --profile desktop add @kdnoesr/maid-companions@0.7.0 --registry=https://registry.npmjs.org
```

安裝完成後重新啟動 DSH，設定中應出現三行：「左右鲸鱼娘女仆」「显示女仆立绘」「液态玻璃效果」。

## 設定

在「設定 → 一般 → 左右鲸鱼娘女仆」中，分別切換「显示女仆立绘」與「液态玻璃效果」。兩項預設開啟，偏好分開儲存。關閉總開關會暫停兩項效果，再次開啟時會恢復各自的選擇。

## 相容性與疑難排解

套件清單宣告支援 DSH `>=0.2.0-rc.2 <0.3.0`。折射效果取決於瀏覽器的濾鏡支援和硬體加速。若捲動不順暢，可單獨關閉液態玻璃。請在同一個設定檔中只啟用此外掛或 `maid-atelier` 佈景主題的其中一項。

## 開發

編輯 [原始碼分片](src/client/parts/README.md)，再重新產生用戶端檔案。技術細節請參閱 [液態玻璃](docs/liquid-glass.md) 與 [浮層涵蓋範圍](docs/overlay-surfaces.md)。

```sh
node scripts/rebuild-parts.mjs
node scripts/assemble-client.mjs --check
```

## 授權與署名

程式碼採用 BSD-3-Clause 授權。立繪採用 CC BY-NC-SA 4.0 授權，即使內嵌於用戶端檔案，仍適用原授權。立繪禁止商業使用。 [LICENSE](LICENSE) · [LICENSE-ARTWORK](LICENSE-ARTWORK) · [NOTICE](NOTICE)

1. **上善** 創作原始鯨魚娘角色。 [Pixiv](https://www.pixiv.net/users/62155430) · [Bilibili](https://b23.tv/8h5L4xz)
2. **ZipZipPipe** 以 GPT Image 2 創作加入 DeepSeek 元素的女僕二次設計。 [Pixiv](https://www.pixiv.net/users/18604994) · [Bilibili](https://b23.tv/Pnw6nG8)
3. **Small-tailqwq** 製作 maid-atelier 佈景主題。 [dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale)

DeepSeek Harness 的非官方第三方外掛。外掛問題請回報至本儲存庫。 [Issues](https://github.com/Kdnoesr/maid-companions/issues)
