import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const extractPageLines = (items) => {
  const lines = []
  for (const item of items) {
    const text = normalizeText(item.str)
    if (!text) continue
    const y = item.transform?.[5] || 0
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= 3)
    if (!line) {
      line = { y, items: [] }
      lines.push(line)
    }
    line.items.push({ x: item.transform?.[4] || 0, text })
  }

  return lines
    .sort((left, right) => right.y - left.y)
    .map((line) => line.items.sort((left, right) => left.x - right.x).map((item) => item.text).join(' '))
    .filter(Boolean)
}

export const extractPdfText = async (dataset) => {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(await dataset.blob.arrayBuffer()),
    disableAutoFetch: true,
    disableStream: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  })
  const pdfDocument = await loadingTask.promise
  const pages = []

  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push({ pageNumber, text: extractPageLines(content.items).join('\n') })
    }
  } finally {
    try {
      if (typeof loadingTask.destroy === 'function') await loadingTask.destroy()
      else if (typeof pdfDocument.destroy === 'function') await pdfDocument.destroy()
    } catch {
      // PDF.js cleanup varies by build; cleanup failure must not hide extracted text.
    }
  }

  const text = pages.map((page) => `[第 ${page.pageNumber} 页]\n${page.text}`).join('\n\n').trim()
  if (!text) throw new Error('该 PDF 未提取到可理解的文本。扫描件需要先进行 OCR。')
  return { text, pages, pageCount: pages.length }
}
