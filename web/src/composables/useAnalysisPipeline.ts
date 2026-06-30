import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UploadUserFile } from 'element-plus'
import { ElMessage } from 'element-plus'
import { analyze, type StageEvent } from '@/api/client'
import { compressImage, formatSize } from '@/utils/compressImage'
import type { AgentStep, AccidentReportView } from '@/types'
import type { SupportedLanguage } from '@/i18n/types'

export interface StepDef {
  key: string
  label: string
}

export function useAnalysisPipeline() {
  const { t, locale } = useI18n()

  const DEFAULT_STEPS: StepDef[] = [
    { key: 'vision', label: t('agent.vision.label') },
    { key: 'severity', label: t('agent.severity.label') },
    { key: 'liability', label: t('agent.liability.label') },
    { key: 'report', label: t('agent.report.label') },
  ]

  const fileList = ref<UploadUserFile[]>([])
  const description = ref('')
  const running = ref(false)
  const errorMsg = ref('')
  const finalReport = ref<AccidentReportView | null>(null)
  const expandedKey = ref<string | null>(null)

  const steps = reactive<AgentStep[]>(
    DEFAULT_STEPS.map((s) => ({ key: s.key, label: s.label, status: 'wait' as const, data: undefined })),
  )

  function resetSteps(): void {
    for (const s of steps) {
      s.status = 'wait'
      s.data = undefined
    }
    finalReport.value = null
    errorMsg.value = ''
  }

  function resetAll(): void {
    resetSteps()
    fileList.value = []
    description.value = ''
    expandedKey.value = null
  }

  function findStep(key?: string): AgentStep | undefined {
    return steps.find((s) => s.key === key)
  }

  async function run(): Promise<void> {
    const rawFiles = fileList.value
      .map((f) => f.raw)
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
    if (rawFiles.length === 0 && !description.value.trim()) {
      ElMessage.warning(t('pipeline.uploadWarning'))
      return
    }

    // Auto-compress images over 512KB
    const results = await Promise.all(rawFiles.map((f) => compressImage(f)))
    const files = results.map((r) => r.file)

    // Summarize compression results
    const compressed = results.filter((r) => r.wasCompressed)
    if (compressed.length > 0) {
      const originalTotal = compressed.reduce((s, r) => s + r.originalSize, 0)
      const compressedTotal = compressed.reduce((s, r) => s + r.compressedSize, 0)
      const label =
        compressed.length === 1
          ? t('pipeline.compressedImage')
          : t('pipeline.compressedMultiple', { n: compressed.length })
      ElMessage.info(`${label}: ${formatSize(originalTotal)} → ${formatSize(compressedTotal)}`)
    }
    resetSteps()
    expandedKey.value = null
    running.value = true
    try {
      await analyze(files, description.value, locale.value as SupportedLanguage, (ev: StageEvent) => {
        if (ev.type === 'stage_start') {
          const s = findStep(ev.stage)
          if (s) {
            s.status = 'process'
            s.skillNames = ev.skillNames ?? []
          }
        } else if (ev.type === 'stage_complete') {
          expandedKey.value = ev.stage ?? null
          const s = findStep(ev.stage)
          if (s) {
            s.status = 'finish'
            s.data = ev.data
            s.skillNames = ev.skillNames ?? []
          }
        } else if (ev.type === 'done') {
          finalReport.value = ev.report as AccidentReportView
        } else if (ev.type === 'error') {
          errorMsg.value = ev.message ?? t('analyze.analysisFailed')
          const s = steps.find((x) => x.status === 'process')
          if (s) s.status = 'error'
        }
      })
    } catch (e) {
      errorMsg.value = e instanceof Error ? e.message : String(e)
    } finally {
      running.value = false
    }
  }

  return {
    // state
    fileList,
    description,
    running,
    errorMsg,
    finalReport,
    expandedKey,
    steps,
    // actions
    run,
    resetAll,
  }
}
