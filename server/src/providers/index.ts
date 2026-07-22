import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { config } from '../config'

const visionProvider = createOpenAICompatible({
  name: 'qwen-vision',
  baseURL: config.vision.baseURL,
  apiKey: config.vision.apiKey,
  supportsStructuredOutputs: true,
})

const reasoningProvider = createOpenAICompatible({
  name: 'deepseek-reasoning',
  baseURL: config.reasoning.baseURL,
  apiKey: config.reasoning.apiKey,
  supportsStructuredOutputs: true,
  transformRequestBody: (body) => ({ ...body, enable_thinking: false }),
})

const embeddingProvider = createOpenAICompatible({
  name: 'qwen-embedding',
  baseURL: config.embedding.baseURL,
  apiKey: config.embedding.apiKey,
})

/** 视觉模型：图像识别智能体使用（Qwen3-VL） */
export const visionModel = visionProvider.chatModel(config.vision.model)

/** 推理模型：严重度/责任/报告智能体使用（Qwen3.5-397B-A17B） */
export const reasoningModel = reasoningProvider.chatModel(config.reasoning.model)

/** 嵌入模型：RAG 向量化使用（Qwen3-Embedding-8B） */
export const embeddingModel = embeddingProvider.textEmbeddingModel(config.embedding.model)
