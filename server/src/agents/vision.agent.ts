import { createLogger } from '../utils/logger'
import { visionModel } from '../providers/index'
import { sceneSchema, type SceneDescription } from './schemas'
import { generateStructured } from './helpers'

const log = createLogger('vision-agent')

type ContentPart = { type: 'text'; text: string } | { type: 'image'; image: Buffer }

/** 图像识别智能体：使用 Qwen3-VL 分析事故现场图片 */
export async function recognizeScene(
  images: Buffer[],
  description: string,
  tools?: Record<string, any>,
): Promise<SceneDescription> {
  log.info(`开始识别 — 图片 ${images.length} 张, 描述: "${description.slice(0, 80)}"`)

  const content: ContentPart[] = [
    {
      type: 'text',
      text: `请客观分析以下交通事故现场图片，识别车辆/交通参与者、受损部位、路况、天气与交通信号等。\n补充文字描述：${description || '（无）'}`,
    },
    ...images.map((image): ContentPart => ({ type: 'image', image })),
  ]

  const object = await generateStructured<SceneDescription>({
    model: visionModel,
    schema: sceneSchema,
    tools,
    system:
      '你是交通事故现场图像识别智能体。只描述图片中客观可见的信息，不臆测，未知信息如实标注。',
    messages: [{ role: 'user', content }],
  })

  log.info(`识别完成 — 车辆 ${object.vehicles?.length ?? 0} 辆`)
  return object
}
