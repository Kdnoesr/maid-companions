# Maid Companions

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md)

[![npm](https://img.shields.io/npm/v/@kdnoesr/maid-companions?label=npm)](https://www.npmjs.com/package/@kdnoesr/maid-companions)

Maid Companions adds two whale-maid portraits to the conversation area in DeepSeek Harness (DSH) and gives the composer and selected overlays a Liquid Glass effect.

## Installation

Open Plugins → Add Plugin in the DSH sidebar and paste the package name below. Restart DSH after installing.

```text
@kdnoesr/maid-companions
```

```sh
dsh plugin --profile desktop add '@kdnoesr/maid-companions'
```

GitHub main and npm 0.7.0 both include the two independent switches. If the npm mirror is unreliable on your machine, paste the Git spec below into the same field:

```text
github:Kdnoesr/maid-companions#main
```

### Upgrading from 0.6.0 or earlier

0.6.0 shows a single master switch. Installing over it can silently fall back to the old version: when the mirror times out or resolution fails, the new files are never installed while the old ones stay in the profile, so it looks like the upgrade happened. Remove the plugin first, then install again:

```sh
dsh plugin --profile desktop remove @kdnoesr/maid-companions
dsh plugin --profile desktop add github:Kdnoesr/maid-companions#main
```

If add fails with ETIMEDOUT (npm mirror unreachable), retry against the official registry:

```sh
dsh plugin --profile desktop add @kdnoesr/maid-companions@0.7.0 --registry=https://registry.npmjs.org
```

After installing, restart DSH. Settings should show three rows: the master switch plus “显示女仆立绘” and “液态玻璃效果”.

## Settings

Open Settings → General and find the plugin row labeled “左右鲸鱼娘女仆”. Use “显示女仆立绘” to show or hide the portraits and “液态玻璃效果” to toggle Liquid Glass. Both are on by default and saved separately. The master switch pauses both effects and restores your choices when turned back on.

## Compatibility and troubleshooting

The package declares support for DSH `>=0.2.0-rc.2 <0.3.0`. Refraction depends on browser filter support and hardware acceleration. If scrolling feels sluggish, turn off Liquid Glass and keep the portraits on. Enable either this plugin or the `maid-atelier` skin in a given profile.

## Development

Edit the [client source parts](src/client/parts/README.md) and rebuild the client bundle. See the [Liquid Glass notes](docs/liquid-glass.md) and [overlay coverage](docs/overlay-surfaces.md) for implementation details.

```sh
node scripts/rebuild-parts.mjs
node scripts/assemble-client.mjs --check
```

## Licenses and credits

The code is licensed under BSD-3-Clause. The artwork is licensed under CC BY-NC-SA 4.0, including when embedded in the client bundle. Commercial use of the artwork is prohibited. [LICENSE](LICENSE) · [LICENSE-ARTWORK](LICENSE-ARTWORK) · [NOTICE](NOTICE)

1. **上善** created the original whale-girl character. [Pixiv](https://www.pixiv.net/users/62155430) · [Bilibili](https://b23.tv/8h5L4xz)
2. **ZipZipPipe** created the DeepSeek-inspired maid redesign (GPT Image 2). [Pixiv](https://www.pixiv.net/users/18604994) · [Bilibili](https://b23.tv/Pnw6nG8)
3. **Small-tailqwq** created the maid-atelier skin. [dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale)

An unofficial third-party plugin for DeepSeek Harness. Report plugin issues in this repository. [Issues](https://github.com/Kdnoesr/maid-companions/issues)
