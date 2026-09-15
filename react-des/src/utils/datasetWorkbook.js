import * as XLSX from 'xlsx'

export const readDatasetWorkbook = async (dataset, options = {}) => {
  if (dataset.extension?.toLowerCase() === 'csv') {
    const text = (await dataset.blob.text()).replace(/^\uFEFF/, '')
    return XLSX.read(text, { ...options, type: 'string', FS: ',' })
  }
  return XLSX.read(await dataset.blob.arrayBuffer(), { ...options, type: 'array' })
}