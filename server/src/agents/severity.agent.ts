import { createLogger } from '../utils/logger'
import { reasoningModel } from '../providers/index'
import { severitySchema, type SceneDescription, type SeverityAssessment } from './schemas'
import { generateStructured } from './helpers'

const log = createLogger('severity-agent')

/** 严重程度评估智能体：基于现场识别结果评估事故严重等级 */
export async function assessSeverity(
  scene: SceneDescription,
  description: string,
  tools?: Record<string, any>,
): Promise<SeverityAssessment> {
  log.info(`开始评估 — 描述: "${description.slice(0, 80)}"`)

  const object = await generateStructured<SeverityAssessment>({
    model: reasoningModel,
    schema: severitySchema,
    tools,
    system:
      '你是交通事故严重程度评估智能体。结合现场识别结果与描述，评估事故严重等级、人员伤亡风险与财产损失，并给出置信度与依据。',
    prompt: `现场识别结果(JSON)：\n${JSON.stringify(scene, null, 2)}\n\n补充描述：${description || '（无）'}`,
  })

  log.info(`评估完成 — level=${object.level}, confidence=${object.confidence}`)
  return object
}
