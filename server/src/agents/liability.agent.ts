import { createLogger } from '../utils/logger'
import { reasoningModel } from '../providers/index'
import { formatLegalContext, retrieveLegalContext } from '../rag/retriever'
import {
  liabilitySchema,
  type LiabilityAnalysis,
  type SceneDescription,
  type SeverityAssessment,
} from './schemas'
import { generateStructured } from './helpers'

const log = createLogger('liability-agent')

/** 责任判定智能体：结合 RAG 检索的法律法规进行责任划分 */
export async function analyzeLiability(
  scene: SceneDescription,
  severity: SeverityAssessment,
  description: string,
  tools?: Record<string, any>,
): Promise<{ analysis: LiabilityAnalysis; legalContext: string }> {
  const query = `${scene.sceneSummary} ${description} 交通事故责任认定`
  log.info(`RAG 检索 — query: "${query.slice(0, 100)}"`)

  const chunks = await retrieveLegalContext(query, 5)
  const hasArticles = chunks.length > 0

  log.info(`RAG 检索结果 — chunks=${chunks.length}, hasArticles=${hasArticles}`)
  if (hasArticles) {
    log.debug('RAG 检索到的条文', chunks.map((c) => `${c.source} ${c.articleNo ?? ''}`))
  }

  const legalContext = formatLegalContext(chunks)
  const system = hasArticles
    ? '你是交通事故责任判定智能体。必须严格依据给出的法律法规条文进行责任划分，所有责任比例之和应为 100。citedArticles 只能引用下方提供的法条（格式："来源 条号"），严禁引用未提供的条文。'
    : '你是交通事故责任判定智能体。所有责任比例之和应为 100。当前知识库中未检索到相关法律法规，citedArticles 必须为空数组 []，严禁凭记忆编造任何法条。在 conclusion 中如实说明"未检索到相关法条，以下判定基于通用交通规则常识"。'

  log.debug('system prompt', system.slice(0, 150))

  const object = await generateStructured<LiabilityAnalysis>({
    model: reasoningModel,
    schema: liabilitySchema,
    tools,
    system,
    prompt: `现场识别(JSON)：\n${JSON.stringify(scene)}\n\n严重程度(JSON)：\n${JSON.stringify(
      severity,
    )}\n\n补充描述：${description || '（无）'}\n\n可参考的法律法规条文：\n${legalContext}`,
  })

  log.info(`模型返回 citedArticles 数量: ${object.citedArticles?.length ?? 0}`, object.citedArticles)

  // 程序级兜底：RAG 无结果时强制清空 citedArticles，防止模型编造法条
  if (!hasArticles) {
    if (object.citedArticles && object.citedArticles.length > 0) {
      log.warn(`RAG 无结果但模型编造了 ${object.citedArticles.length} 条引用 → 强制清空`)
    }
    object.citedArticles = []
  }

  return { analysis: object, legalContext }
}
