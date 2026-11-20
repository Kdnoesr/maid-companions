# 双界面折射与菲涅耳边缘反光

上一轮五份资料的比较见 [Apple 风格光学研究](apple-inspired-optics-research.md)。本轮用 [PBRT 的镜面反射与透射章节](https://www.pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission) 核对斯涅尔定律和非偏振菲涅耳方程，并复查 [早期 SVG 示例](https://liunian.js.org/posts/liquid-glass/)、[Liquid Glass React](https://github.com/rdev/liquid-glass-react) 和 [HTML in Canvas 的着色器示例](https://html-in-canvas.dev/liquid-glass-effect/)。这些示例分别展示了滤镜采样、自定义边缘模式和独立背景纹理的实现取舍。

## 本轮模型

- 以折射率 1.5、弯曲前表面和平坦后表面为近似。沿相机光线逆向追踪，先算空气到玻璃，再算玻璃到空气。两段横向偏移预计算成深度查找表，映射到圆角矩形的内法线。两次界面的几何计算共用一次背景取样。
- 前表面反射取 s、p 两种偏振的反射率平均值，再按固定左上方光照和对侧补光调节。扣除正入射的约 4% 后，将剩余强度编码到位移图的 B 通道。滤镜把该通道转为白光覆盖量。它表现预设环境光的边缘反光，反射颜色和光源来自模型设定。
- 最大斜率用于限制最终位移，减小边缘采样顺序反转的风险。光路长度、前缘斜率、角度上限、反射增益与背景距离均为界面材质参数。当前实现省略吸收、多次内部反射、色散及真实环境反射纹理。
- 输入框和小型浮层接入新模型，聊天气泡沿用原渲染路径。输入框仍用原来的 1px 模糊与单层采样。位移贴图边长预算为 256px，两项反光合成基元仅用于新模型。

浏览器实现依赖 Chromium 的 SVG 背景滤镜。Apple 公共资料可用于材质层级和观感参考。见 [Apple Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass) 与 [kube.io 的网页折射实验](https://kube.io/blog/liquid-glass-css-svg/)。
