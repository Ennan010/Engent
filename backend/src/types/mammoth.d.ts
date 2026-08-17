declare module 'mammoth' {
  export interface ExtractRawTextOptions {
    buffer?: Buffer
    path?: string
    [key: string]: unknown
  }

  export interface ExtractRawTextResult {
    value: string
    messages: unknown[]
  }

  export function extractRawText(input: ExtractRawTextOptions): Promise<ExtractRawTextResult>
}
