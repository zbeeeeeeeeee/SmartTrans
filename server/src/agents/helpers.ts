import { generateText, Output, stepCountIs } from 'ai'
import type { ZodSchema } from 'zod'
import { createLogger } from '../utils/logger'

const log = createLogger('generate-structured')

interface GenerateOptions {
  model: any
  schema: ZodSchema
  tools?: Record<string, any>
  system?: string
  prompt?: string
  messages?: any[]
}

/**
 * 统一的结构化生成入口：
 * 使用 generateText 同时支持 tools（工具调用）和 output（结构化 schema），
 * 一次 LLM 调用完成，避免旧两阶段模式（generateText → generateObject）的双倍耗时。
 *
 * - 无 tools → generateText({ output: { schema } }) — 等价于 generateObject
 * - 有 tools → generateText({ tools, output: { schema }, maxSteps: 10 }) — 工具调用 + 结构化输出一步完成
 */
export async function generateStructured<T>(opts: GenerateOptions): Promise<T> {
  const { model, schema, tools, system, prompt, messages } = opts
  const hasTools = tools && Object.keys(tools).length > 0

  const start = Date.now()

  if (hasTools) {
    log.info(`开始 — 带 ${Object.keys(tools!).length} 个工具: ${Object.keys(tools!).join(', ')}`)
  }

  const result = await generateText({
    model,
    tools: hasTools ? tools : undefined,
    output: Output.object({ schema }),
    system,
    prompt,
    messages: messages as any,
    stopWhen: hasTools ? stepCountIs(10) : stepCountIs(1),
    ...(hasTools
      ? {
          onStepFinish: (event: any) => {
            const stepNumber = event.stepNumber ?? '?'
            const textLen = event.text?.length ?? 0
            const tcCount = event.toolCalls?.length ?? 0
            const tcNames = event.toolCalls?.map((tc: any) => tc.toolName).join(', ') ?? ''
            const trSummary =
              event.toolResults
                ?.map((tr: any) => `${tr.toolName}=${JSON.stringify(tr.result).slice(0, 120)}`)
                .join('; ') ?? ''

            log.info(
              `步骤${stepNumber}/10 — text=${textLen}chars` +
                (tcCount > 0 ? `, toolCalls=${tcCount}[${tcNames}]` : '') +
                (trSummary ? `, results=[${trSummary}]` : '') +
                `, reason=${event.finishReason ?? '?'}`,
            )
          },
        }
      : {}),
  })

  const ms = ((Date.now() - start) / 1000).toFixed(1)
  if (hasTools) {
    log.info(
      `完成 — 总步骤=${(result as any).steps?.length ?? '?'}, toolCalls=${result.toolCalls?.length ?? 0}, 总耗时=${ms}s`,
    )
  }

  return (result as any).output as T
}
