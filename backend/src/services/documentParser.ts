/**
 * 文档解析服务：按扩展名将上传文件内容解析为纯文本。
 *
 * 支持格式：
 * - pdf   使用 pdf-parse（node_modules 内置）
 * - md / txt / markdown  直接按 UTF-8 读取
 * - docx  使用 mammoth 提取纯文本（含表格内文字）
 *
 * 解析失败会抛出带中文提示的错误，由控制器统一转换为 400 响应。
 */

import path from 'node:path'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

/** 文档解析错误（可读提示，控制器映射为 400 响应） */
export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocumentParseError'
  }
}

export type SupportedDocType = 'pdf' | 'md' | 'txt' | 'docx'

export const SUPPORTED_EXTENSIONS: Record<string, SupportedDocType> = {
  pdf: 'pdf',
  md: 'md',
  markdown: 'md',
  txt: 'txt',
  text: 'txt',
  docx: 'docx',
}

/** 从文件名推断文档类型；不支持时返回 null */
export function detectDocType(fileName: string): SupportedDocType | null {
  const ext = path.extname(fileName).slice(1).toLowerCase()
  return SUPPORTED_EXTENSIONS[ext] ?? null
}

/** 文档最大上传大小（字节）：20MB */
export const MAX_DOC_SIZE = 20 * 1024 * 1024

/**
 * 解析文档内容为纯文本
 * @param fileName 原始文件名（用于推断类型）
 * @param buffer 文件二进制内容
 * @returns 提取出的纯文本
 */
export async function parseDocument(fileName: string, buffer: Buffer): Promise<string> {
  if (buffer.length > MAX_DOC_SIZE) {
    throw new DocumentParseError('文件过大，仅支持 20MB 以内的文档')
  }
  const type = detectDocType(fileName)
  if (!type) {
    throw new DocumentParseError('不支持的文件类型，请上传 PDF / Markdown / TXT / DOCX 格式')
  }

  switch (type) {
    case 'pdf': {
      const parser = new PDFParse({ data: buffer })
      try {
        const result = await parser.getText()
        const text = (result.text ?? '').replace(/\u0000/g, '')
        if (!text.trim()) {
          throw new DocumentParseError('PDF 中未提取到文本（可能是扫描件，暂不支持 OCR）')
        }
        return text
      } finally {
        await parser.destroy().catch(() => undefined)
      }
    }
    case 'docx': {
      const result = await mammoth.extractRawText({ buffer })
      const text = (result.value ?? '').trim()
      if (!text) {
        throw new DocumentParseError('DOCX 中未提取到文本')
      }
      return text
    }
    case 'md':
    case 'txt':
    default: {
      const text = buffer.toString('utf-8')
      if (!text.trim()) {
        throw new DocumentParseError('文件内容为空')
      }
      return text
    }
  }
}
