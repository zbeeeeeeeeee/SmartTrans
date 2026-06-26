const THRESHOLD = 512 * 1024 // 512KB
const MAX_DIM = 1920 // 长边最大像素
const QUALITY = 0.75 // JPEG 质量

export interface CompressResult {
  file: File
  originalSize: number
  compressedSize: number
  wasCompressed: boolean
}

/**
 * 格式化字节数为可读字符串
 */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '') + 'MB'
  }
  return Math.round(bytes / 1024) + 'KB'
}

/**
 * 压缩图片（仅当文件 > 512KB 时触发）
 * 基于 Canvas API，无第三方依赖
 */
export function compressImage(file: File): Promise<CompressResult> {
  const originalSize = file.size

  return new Promise((resolve) => {
    // 小文件直接返回
    if (file.size <= THRESHOLD) {
      resolve({ file, originalSize, compressedSize: originalSize, wasCompressed: false })
      return
    }

    loadImage(file)
      .then((img) => {
        const { width, height } = calcSize(img.naturalWidth, img.naturalHeight)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // 压缩效果不佳，用原图
              resolve({ file, originalSize, compressedSize: originalSize, wasCompressed: false })
            } else {
              const name = renameToJpg(file.name)
              const compressedSize = blob.size
              resolve({
                file: new File([blob], name, { type: 'image/jpeg' }),
                originalSize,
                compressedSize,
                wasCompressed: true,
              })
            }
          },
          'image/jpeg',
          QUALITY,
        )
      })
      .catch(() => {
        // 加载失败 → 回退原图
        resolve({ file, originalSize, compressedSize: originalSize, wasCompressed: false })
      })
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

function calcSize(w: number, h: number): { width: number; height: number } {
  const max = Math.max(w, h)
  if (max <= MAX_DIM) return { width: w, height: h }
  const ratio = MAX_DIM / max
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  }
}

function renameToJpg(name: string): string {
  return name.replace(/\.\w+$/, '') + '.jpg'
}
