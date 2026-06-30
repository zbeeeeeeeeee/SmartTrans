// Server-side i18n: all localized strings for prompts, labels, and PDF generation.
// Type is duplicated from frontend to keep server standalone.

export type SupportedLanguage = 'en' | 'zh-CN' | 'zh-TW'

// ---- Agent step labels (SSE events + logs) ----
export const STEP_LABELS: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    vision: 'Vision Agent',
    severity: 'Severity Agent',
    liability: 'Liability Agent',
    report: 'Report Agent',
  },
  'zh-CN': {
    vision: '图像识别智能体',
    severity: '严重程度评估智能体',
    liability: '责任判定智能体',
    report: '报告生成智能体',
  },
  'zh-TW': {
    vision: '影像識別智能體',
    severity: '嚴重程度評估智能體',
    liability: '責任判定智能體',
    report: '報告生成智能體',
  },
}

// ---- Fallback text for empty descriptions ----
const NONE_TEXT: Record<SupportedLanguage, string> = {
  en: '(None)',
  'zh-CN': '（无）',
  'zh-TW': '（無）',
}

// ---- Vision agent ----
export const VISION_SYSTEM_PROMPT: Record<SupportedLanguage, string> = {
  en: 'You are a traffic accident scene image recognition agent. Describe only what is objectively visible in the images. Do not speculate or infer fault. Mark unknown information as unknown.',
  'zh-CN': '你是交通事故现场图像识别智能体。只描述图片中客观可见的信息，不臆测，未知信息如实标注。',
  'zh-TW': '你是交通事故現場影像識別智能體。只描述圖片中客觀可見的資訊，不臆測，未知資訊如實標註。',
}

export function visionUserPrompt(language: SupportedLanguage, description: string): string {
  const templates: Record<SupportedLanguage, string> = {
    en: `Objectively analyze the following traffic accident scene images. Identify vehicles/traffic participants, damaged areas, road conditions, weather, and traffic signals.\n\nSupplementary text description: {description}`,
    'zh-CN': `请客观分析以下交通事故现场图片，识别车辆/交通参与者、受损部位、路况、天气与交通信号等。\n补充文字描述：{description}`,
    'zh-TW': `請客觀分析以下交通事故現場圖片，識別車輛/交通參與者、受損部位、路況、天氣與交通號誌等。\n補充文字描述：{description}`,
  }
  return templates[language].replace('{description}', description || NONE_TEXT[language])
}

// ---- Severity agent ----
export const SEVERITY_SYSTEM_PROMPT: Record<SupportedLanguage, string> = {
  en: 'You are a traffic accident severity assessment agent. Based on the scene analysis results and description, assess the severity level, injury risk, and property damage, providing confidence level and reasoning.',
  'zh-CN': '你是交通事故严重程度评估智能体。结合现场识别结果与描述，评估事故严重等级、人员伤亡风险与财产损失，并给出置信度与依据。',
  'zh-TW': '你是交通事故嚴重程度評估智能體。結合現場識別結果與描述，評估事故嚴重等級、人員傷亡風險與財產損失，並給出置信度與依據。',
}

export function severityUserPrompt(
  language: SupportedLanguage,
  scene: unknown,
  description: string,
): string {
  const templates: Record<SupportedLanguage, string> = {
    en: `Scene analysis results (JSON):\n{scene}\n\nSupplementary description: {description}`,
    'zh-CN': `现场识别结果(JSON)：\n{scene}\n\n补充描述：{description}`,
    'zh-TW': `現場識別結果(JSON)：\n{scene}\n\n補充描述：{description}`,
  }
  return templates[language]
    .replace('{scene}', JSON.stringify(scene, null, 2))
    .replace('{description}', description || NONE_TEXT[language])
}

// ---- Liability agent ----
export const LIABILITY_SYSTEM_WITH_ARTICLES: Record<SupportedLanguage, string> = {
  en: 'You are a traffic accident liability determination agent. You MUST strictly base your liability allocation on the provided legal statutes. The sum of all fault percentages must equal 100. citedArticles can ONLY reference statutes from the provided list (format: "Source ArticleNumber"). DO NOT cite any statutes not provided.',
  'zh-CN': '你是交通事故责任判定智能体。必须严格依据给出的法律法规条文进行责任划分，所有责任比例之和应为 100。citedArticles 只能引用下方提供的法条（格式："来源 条号"），严禁引用未提供的条文。',
  'zh-TW': '你是交通事故責任判定智能體。必須嚴格依據給出的法律法規條文進行責任劃分，所有責任比例之和應為 100。citedArticles 只能引用下方提供的法條（格式："來源 條號"），嚴禁引用未提供的條文。',
}

export const LIABILITY_SYSTEM_WITHOUT_ARTICLES: Record<SupportedLanguage, string> = {
  en: 'You are a traffic accident liability determination agent. The sum of all fault percentages must equal 100. No relevant legal statutes were found in the knowledge base. citedArticles MUST be an empty array []. DO NOT fabricate any statutes from memory. In your conclusion, honestly state: "No relevant statutes were retrieved; the following determination is based on general traffic rules and common sense."',
  'zh-CN': '你是交通事故责任判定智能体。所有责任比例之和应为 100。当前知识库中未检索到相关法律法规，citedArticles 必须为空数组 []，严禁凭记忆编造任何法条。在 conclusion 中如实说明"未检索到相关法条，以下判定基于通用交通规则常识"。',
  'zh-TW': '你是交通事故責任判定智能體。所有責任比例之和應為 100。當前知識庫中未檢索到相關法律法規，citedArticles 必須為空陣列 []，嚴禁憑記憶編造任何法條。在 conclusion 中如實說明「未檢索到相關法條，以下判定基於通用交通規則常識」。',
}

export function liabilityUserPrompt(
  language: SupportedLanguage,
  scene: unknown,
  severity: unknown,
  description: string,
  legalContext: string,
): string {
  const templates: Record<SupportedLanguage, string> = {
    en: `Scene Analysis (JSON):\n{scene}\n\nSeverity Assessment (JSON):\n{severity}\n\nSupplementary Description: {desc}\n\nApplicable Legal Statutes:\n{legal}`,
    'zh-CN': `现场识别(JSON)：\n{scene}\n\n严重程度(JSON)：\n{severity}\n\n补充描述：{desc}\n\n可参考的法律法规条文：\n{legal}`,
    'zh-TW': `現場識別(JSON)：\n{scene}\n\n嚴重程度(JSON)：\n{severity}\n\n補充描述：{desc}\n\n可參考的法律法規條文：\n{legal}`,
  }
  return templates[language]
    .replace('{scene}', JSON.stringify(scene))
    .replace('{severity}', JSON.stringify(severity))
    .replace('{desc}', description || NONE_TEXT[language])
    .replace('{legal}', legalContext)
}

// ---- Report agent ----
export const REPORT_SYSTEM_PROMPT: Record<SupportedLanguage, string> = {
  en: 'You are a traffic accident report generation agent. Synthesize the scene analysis, severity assessment, and liability determination to produce an objective, well-structured accident analysis report with recommendations. citedArticles MUST be taken directly from the liability determination; DO NOT fabricate or supplement any statutes from memory.',
  'zh-CN': '你是交通事故报告生成智能体。综合现场识别、严重程度与责任判定，生成客观、条理清晰的结构化事故分析报告，并给出处理建议。citedArticles 必须直接使用责任判定中给出的法条，严禁凭记忆编造或补充任何法条。',
  'zh-TW': '你是交通事故報告生成智能體。綜合現場識別、嚴重程度與責任判定，生成客觀、條理清晰的結構化事故分析報告，並給出處理建議。citedArticles 必須直接使用責任判定中給出的法條，嚴禁憑記憶編造或補充任何法條。',
}

export function reportUserPrompt(
  language: SupportedLanguage,
  input: {
    scene: unknown
    severity: unknown
    liability: unknown
    description: string
  },
): string {
  const templates: Record<SupportedLanguage, string> = {
    en: `Supplementary description: {desc}\n\nScene Analysis:\n{scene}\n\nSeverity Assessment:\n{severity}\n\nLiability Determination:\n{liability}`,
    'zh-CN': `补充描述：{desc}\n\n现场识别：\n{scene}\n\n严重程度：\n{severity}\n\n责任判定：\n{liability}`,
    'zh-TW': `補充描述：{desc}\n\n現場識別：\n{scene}\n\n嚴重程度：\n{severity}\n\n責任判定：\n{liability}`,
  }
  return templates[language]
    .replace('{desc}', input.description || NONE_TEXT[language])
    .replace('{scene}', JSON.stringify(input.scene))
    .replace('{severity}', JSON.stringify(input.severity))
    .replace('{liability}', JSON.stringify(input.liability))
}

// ---- PDF labels ----
export const PDF_LABELS: Record<
  SupportedLanguage,
  {
    title: string
    author: string
    subject: string
    basicInfo: string
    reportTitleLabel: string
    generatedAt: string
    severityLevel: string
    summary: string
    scene: string
    liabilityFinding: string
    citedArticles: string
    recommendations: string
    none: string
    footer: string
    severityLabels: Record<string, string>
  }
> = {
  en: {
    title: 'Traffic Accident Analysis Report',
    author: 'SmartTrans Multi-Agent System',
    subject: 'Traffic Accident Analysis',
    basicInfo: 'Basic Information',
    reportTitleLabel: 'Report Title',
    generatedAt: 'Generated',
    severityLevel: 'Severity',
    summary: 'Accident Summary',
    scene: 'Scene Situation',
    liabilityFinding: 'Liability Determination',
    citedArticles: 'Cited Legal Articles',
    recommendations: 'Recommendations',
    none: '(None)',
    footer:
      'This report is auto-generated by the SmartTrans Multi-Agent System for reference only.',
    severityLabels: { minor: 'Minor', moderate: 'Moderate', severe: 'Severe' },
  },
  'zh-CN': {
    title: '交通事故分析报告',
    author: 'SmartTrans 多智能体系统',
    subject: '交通事故分析',
    basicInfo: '基本信息',
    reportTitleLabel: '报告标题',
    generatedAt: '生成时间',
    severityLevel: '严重等级',
    summary: '事故概要',
    scene: '现场情况',
    liabilityFinding: '责任认定',
    citedArticles: '引用法条',
    recommendations: '处理建议',
    none: '（无）',
    footer: '本报告由 SmartTrans 多智能体系统自动生成，仅供参考',
    severityLabels: { minor: '轻微', moderate: '一般', severe: '严重' },
  },
  'zh-TW': {
    title: '交通事故分析報告',
    author: 'SmartTrans 多智能體系統',
    subject: '交通事故分析',
    basicInfo: '基本資訊',
    reportTitleLabel: '報告標題',
    generatedAt: '生成時間',
    severityLevel: '嚴重等級',
    summary: '事故概要',
    scene: '現場情況',
    liabilityFinding: '責任認定',
    citedArticles: '引用法條',
    recommendations: '處理建議',
    none: '（無）',
    footer: '本報告由 SmartTrans 多智能體系統自動生成，僅供參考',
    severityLabels: { minor: '輕微', moderate: '一般', severe: '嚴重' },
  },
}
