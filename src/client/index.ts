/**
 * @dsh-external/maid-companions — 左右鲸鱼娘女仆（原始界面可显示）+ 通用设置总开关。
 * 客户端：往 settings.general.item 注入「左右鲸鱼娘女仆」开关，并在对话区
 * 注入两位鲸鱼娘立绘（正确分层、带会话切换缩放/动画）。开关关闭即完全恢复原版 UI。
 * 亮度约定：开始对话（立绘缩小）前后亮度恒定，不随会话激活/暗色主题衰减。
 * ⚠️ 两个必坑：① apply 用 ctx.slots 必须 export const inject = ['slots']；
 * ② slots.register 的 name 必须是已知 slot（settings.general.item），且写法为
 * register({ name: 'settings.general.item' ... })（self-heal 校验按此行匹配，
 * 缺了报 slot undefined is not declared）。
 */
import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'

type ClientContext = {
  slots: SlotsService
}

export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  // 设置页开关（真实客户端在 lib/client.js；此处仅为保持 src 骨架与 lib 一致，
  // 使 super-injector 的 client 骨架校验通过，避免重启时被误判为坏插件而跳过恢复）。
  ctx.slots.inject('settings.general.item', () =>
    ctx.slots.register({ name: 'settings.general.item', id: 'maid-companions-enabled', order: 25 }),
  )
}
