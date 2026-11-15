// comfyui-pilot · 本地生图服务的开关
//
// 平时 ComfyUI 不跑，一个字节显存都不占。
// 要画图时调 comfyui(action=up) 把它拉起来；画完不用管，
// 闲置一段时间由一个独立守护进程自动关掉（DSH 退出也照样生效）。
//
// 实际启停逻辑在 D:\AI\comfyui-control.ps1，这里只做工具封装。
// 注意：这台机器的 PATH 里只有 Windows PowerShell 5.1，没有 pwsh 7；
// 而且 .ps1 被 ExecutionPolicy 拦着，所以必须带 -ExecutionPolicy Bypass。

import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'

export const name = 'comfyui-pilot'
export const inject = ['tools']

const CFG = {
  script: 'D:\\AI\\comfyui-control.ps1',
  shell: 'powershell.exe',
  defaultIdleMinutes: 5,
}

const log = (...a) => console.log('[comfyui-pilot]', ...a)

function runScript(args, timeout = 180_000) {
  return new Promise((resolve) => {
    execFile(
      CFG.shell,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', CFG.script, ...args],
      { timeout, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        const out = String(stdout || '').trim()
        const errText = String(stderr || '').trim()
        // PowerShell 5.1 的报错有时会混进 stdout，两边都保留
        const text = [out, errText].filter(Boolean).join('\n')
        resolve({ ok: !err, text: text || (err ? String(err.message) : '（脚本没有输出）') })
      },
    )
  })
}

export function apply(ctx, config) {
  const idleDefault = Number(config?.idleMinutes) > 0 ? Number(config.idleMinutes) : CFG.defaultIdleMinutes

  ctx.tools.register(defineTool({
    name: 'comfyui',
    description:
      '本地生图服务 ComfyUI 的开关。凡是准备调用 generate_image / edit_image / generate_images 之前，' +
      '先调一次 action=up 把它拉起来（已经开着会秒回，冷启动约 20 秒）。生成完不用管——闲置一段时间会自己休眠、把显存还回去。' +
      '另外：action=down 立刻释放显存，action=status 查当前是否在跑、占多少显存。',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: ['up', 'down', 'status'],
        description: 'up 启动（画图前用）/ down 立刻停止 / status 查状态。',
      },
      idleMinutes: {
        type: 'number',
        description: `这次启动后空闲多少分钟自动休眠，默认 ${idleDefault}。`,
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          text: { type: 'string' },
        },
      },
      render(_args, value) {
        const mark = value && value.ok === false ? '✗' : '✓'
        return [{ type: 'text', text: `${mark} ${value?.text ?? ''}` }]
      },
    },
    async execute(args) {
      const action = String(args?.action || 'status')
      if (action === 'up') {
        const idle = Number(args?.idleMinutes) > 0 ? Number(args.idleMinutes) : idleDefault
        const r = await runScript(['-Action', 'up', '-IdleMinutes', String(idle)], 180_000)
        log('up ->', r.text)
        return r
      }
      if (action === 'down') {
        const r = await runScript(['-Action', 'down'], 60_000)
        log('down ->', r.text)
        return r
      }
      const r = await runScript(['-Action', 'status'], 30_000)
      log('status ->', r.text)
      return r
    },
  }))

  log('tool comfyui registered (idle default', idleDefault, 'min)')
}
