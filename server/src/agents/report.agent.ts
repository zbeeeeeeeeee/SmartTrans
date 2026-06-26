import { createLogger } from '../utils/logger'
import { reasoningModel } from '../providers/index'
import {
  reportSchema,
  type AccidentReport,
  type LiabilityAnalysis,
  type SceneDescription,
  type SeverityAssessment,
} from './schemas'
import { generateStructured } from './helpers'

const log = createLogger('report-agent')

/** 报告生成智能体：综合各智能体结果生成结构化事故报告 */
export async function generateReport(
  input: {
    scene: SceneDescription
    severity: SeverityAssessment
    liability: LiabilityAnalysis
    description: string
  },
  tools?: Record<string, any>,
): Promise<AccidentReport> {
  const inputCitedCount = input.liability.citedArticles?.length ?? 0
  log.info(`开始生成报告 — 输入 citedArticles=${inputCitedCount}`)

  const object = await generateStructured<AccidentReport>({
    model: reasoningModel,
    schema: reportSchema,
    tools,
    system:
      '你是交通事故报告生成智能体。综合现场识别、严重程度与责任判定，生成客观、条理清晰的结构化事故分析报告，并给出处理建议。citedArticles 必须直接使用责任判定中给出的法条，严禁凭记忆编造或补充任何法条。',
    prompt: `补充描述：${input.description || '（无）'}\n\n现场识别：\n${JSON.stringify(
      input.scene,
    )}\n\n严重程度：\n${JSON.stringify(input.severity)}\n\n责任判定：\n${JSON.stringify(
      input.liability,
    )}`,
  })

  // 程序级兜底：责任判定阶段无 citedArticles 时，报告也强制为空
  if (!input.liability.citedArticles || input.liability.citedArticles.length === 0) {
    if (object.citedArticles && object.citedArticles.length > 0) {
      log.warn(`输入 citedArticles 为空但模型编造了 ${object.citedArticles.length} 条 → 强制清空`)
    }
    object.citedArticles = []
  }

  log.info(`报告生成完成 — citedArticles=${object.citedArticles?.length ?? 0}`)
  return object
}
