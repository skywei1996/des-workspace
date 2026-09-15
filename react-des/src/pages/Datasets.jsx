import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import Sidebar from '../components/Sidebar'
import { clearLocalDatasets, deleteLocalDataset, listLocalDatasets, saveLocalDataset } from '../utils/datasetStorage'
import { readDatasetWorkbook } from '../utils/datasetWorkbook'

const Icon = ({ name, className = 'h-4 w-4' }) => {
  const paths = {
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 14v5h14v-5" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    download: <><path d="M12 4v11m0 0 4-4m-4 4-4-4" /><path d="M5 19h14" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7" /><path d="M10 11v5m4-5v5" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    file: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name]}</svg>
}

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`
}

const formatDate = (value) => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

const getFileKind = (extension) => {
  if (['xlsx', 'xls'].includes(extension)) return 'Excel'
  if (extension === 'csv') return 'CSV'
  if (['docx', 'doc'].includes(extension)) return 'Word'
  if (extension === 'pdf') return 'PDF'
  if (['txt', 'md', 'json', 'xml'].includes(extension)) return '文本'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) return '图片'
  return extension ? extension.toUpperCase() : '文件'
}

const PreviewModal = ({ dataset, onClose }) => {
  const [preview, setPreview] = useState({ status: 'loading', kind: '', data: null, error: '' })

  useEffect(() => {
    let active = true
    let objectUrl = ''
    const loadPreview = async () => {
      try {
        const extension = dataset.extension
        if (['xlsx', 'xls', 'csv'].includes(extension)) {
          const workbook = await readDatasetWorkbook(dataset)
          const sheetName = workbook.SheetNames[0]
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' }).slice(0, 100)
          if (active) setPreview({ status: 'ready', kind: 'table', data: { sheetName, rows }, error: '' })
        } else if (extension === 'docx') {
          const result = await mammoth.extractRawText({ arrayBuffer: await dataset.blob.arrayBuffer() })
          if (active) setPreview({ status: 'ready', kind: 'text', data: result.value || '文档没有可提取的文本内容。', error: '' })
        } else if (['txt', 'md', 'json', 'xml'].includes(extension)) {
          if (active) setPreview({ status: 'ready', kind: 'text', data: await dataset.blob.text(), error: '' })
        } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'].includes(extension)) {
          objectUrl = URL.createObjectURL(dataset.blob)
          if (active) setPreview({ status: 'ready', kind: extension === 'pdf' ? 'pdf' : 'image', data: objectUrl, error: '' })
        } else {
          if (active) setPreview({ status: 'ready', kind: 'unsupported', data: null, error: '' })
        }
      } catch (error) {
        if (active) setPreview({ status: 'error', kind: '', data: null, error: error.message || '文件解析失败' })
      }
    }
    loadPreview()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [dataset])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-5" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <div className="min-w-0"><h2 className="truncate text-lg font-semibold text-[#20242b]">{dataset.name}</h2><p className="mt-1 text-xs text-[#737b87]">{getFileKind(dataset.extension)} · {formatBytes(dataset.size)}</p></div>
          <button type="button" title="关闭" onClick={onClose} className="flex h-9 w-9 items-center justify-center text-[#68707c] hover:bg-[#f3f4f6]"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="min-h-[420px] flex-1 overflow-auto bg-[#f7f8fa] p-6">
          {preview.status === 'loading' && <div className="flex h-80 items-center justify-center text-sm text-[#737b87]">正在解析文件...</div>}
          {preview.status === 'error' && <div className="flex h-80 items-center justify-center text-sm text-red-600">{preview.error}</div>}
          {preview.kind === 'table' && <div className="overflow-auto border border-[#dfe3e8] bg-white"><div className="border-b border-[#e5e7eb] px-4 py-2 text-xs text-[#68707c]">工作表：{preview.data.sheetName}，展示前 100 行</div><table className="min-w-full border-collapse text-sm"><tbody>{preview.data.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className={`max-w-[320px] border-b border-r border-[#e5e7eb] px-3 py-2 ${rowIndex === 0 ? 'bg-[#f3f4f6] font-medium' : 'bg-white'}`}>{String(cell)}</td>)}</tr>)}</tbody></table></div>}
          {preview.kind === 'text' && <pre className="min-h-[360px] whitespace-pre-wrap break-words border border-[#dfe3e8] bg-white p-5 font-sans text-sm leading-7 text-[#303741]">{preview.data}</pre>}
          {preview.kind === 'image' && <div className="flex justify-center"><img src={preview.data} alt={dataset.name} className="max-h-[65vh] max-w-full object-contain" /></div>}
          {preview.kind === 'pdf' && <iframe title={dataset.name} src={preview.data} className="h-[65vh] w-full border border-[#dfe3e8] bg-white" />}
          {preview.kind === 'unsupported' && <div className="flex h-80 flex-col items-center justify-center text-center"><Icon name="file" className="h-12 w-12 text-[#a2a9b3]" /><div className="mt-4 font-medium text-[#303741]">暂不支持在线预览此格式</div><div className="mt-2 text-sm text-[#737b87]">可下载文件后使用本地应用打开。</div></div>}
        </div>
      </div>
    </div>
  )
}

const Datasets = () => {
  const inputRef = useRef(null)
  const [datasets, setDatasets] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('全部')
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = async () => setDatasets(await listLocalDatasets())
  useEffect(() => { refresh() }, [])

  const filteredDatasets = useMemo(() => datasets.filter((dataset) => {
    const kind = getFileKind(dataset.extension)
    return dataset.name.toLowerCase().includes(search.toLowerCase()) && (filter === '全部' || kind === filter)
  }), [datasets, filter, search])

  const handleImport = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    setBusy(true)
    setMessage('')
    try {
      await Promise.all(files.map(saveLocalDataset))
      await refresh()
      setMessage(`已导入 ${files.length} 个文件`)
    } catch (error) {
      setMessage(`导入失败：${error.message}`)
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  const handleDownload = (dataset) => {
    const url = URL.createObjectURL(dataset.blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = dataset.name
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (dataset) => {
    if (!window.confirm(`确认删除“${dataset.name}”？此操作不可恢复。`)) return
    await deleteLocalDataset(dataset.id)
    await refresh()
    if (selected?.id === dataset.id) setSelected(null)
  }

  const handleDeleteAll = async () => {
    if (!datasets.length || !window.confirm(`确认删除全部 ${datasets.length} 个文件？此操作不可恢复。`)) return
    setBusy(true)
    setMessage('')
    try {
      await clearLocalDatasets()
      setDatasets([])
      setSelected(null)
      setMessage(`已删除全部 ${datasets.length} 个文件`)
    } catch (error) {
      setMessage(`删除失败：${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa] text-[#252a32]">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-[#e4e7eb] bg-white px-8 py-5">
          <div><h1 className="text-2xl font-semibold">数据集</h1><p className="mt-1 text-sm text-[#737b87]">导入并管理当前浏览器中的本地文件资源。</p></div>
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="flex h-10 items-center gap-2 bg-[#e10d0d] px-4 text-sm font-medium text-white hover:bg-[#c90b0b] disabled:opacity-60"><Icon name="upload" />{busy ? '正在导入' : '导入文件'}</button>
          <input ref={inputRef} type="file" multiple accept=".xlsx,.xls,.csv,.docx,.doc,.pdf,.txt,.md,.json,.xml,.png,.jpg,.jpeg,.gif,.webp" onChange={handleImport} className="hidden" />
        </header>
        <section className="flex-1 overflow-auto p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="relative w-full max-w-md"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b929c]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索文件名称" className="h-10 w-full border border-[#d9dde3] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#9fa6b0]" /></div>
            <div className="flex items-center gap-3"><select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 border border-[#d9dde3] bg-white px-3 text-sm outline-none"><option>全部</option><option>Excel</option><option>CSV</option><option>Word</option><option>PDF</option><option>文本</option><option>图片</option></select><span className="text-sm text-[#737b87]">共 {filteredDatasets.length} 个文件</span><button type="button" disabled={busy || datasets.length === 0} onClick={handleDeleteAll} className="flex h-10 items-center gap-2 border border-[#efb4b4] bg-white px-3 text-sm font-medium text-[#d12f2f] hover:bg-[#fff0f0] disabled:cursor-not-allowed disabled:opacity-40"><Icon name="trash" />全部删除</button></div>
          </div>
          {message && <div className="mb-4 border border-[#dce9dd] bg-[#f3faf4] px-4 py-3 text-sm text-[#35783e]">{message}</div>}
          {filteredDatasets.length === 0 ? <div className="flex min-h-[420px] flex-col items-center justify-center border border-dashed border-[#cfd5dc] bg-white"><Icon name="upload" className="h-10 w-10 text-[#9ca3ad]" /><h2 className="mt-4 text-base font-semibold">暂无本地数据集</h2><p className="mt-2 text-sm text-[#737b87]">导入 Excel、Word、PDF 或其他常用文件。</p><button type="button" onClick={() => inputRef.current?.click()} className="mt-5 border border-[#d9dde3] bg-white px-4 py-2 text-sm font-medium hover:bg-[#f7f8fa]">选择文件</button></div> : <div className="overflow-hidden border border-[#dfe3e8] bg-white"><div className="grid grid-cols-[minmax(260px,1fr)_120px_120px_190px_150px] border-b border-[#dfe3e8] bg-[#f3f4f6] px-5 py-3 text-xs font-medium text-[#68707c]"><span>文件名称</span><span>类型</span><span>大小</span><span>导入时间</span><span className="text-right">操作</span></div>{filteredDatasets.map((dataset) => <div key={dataset.id} className="grid grid-cols-[minmax(260px,1fr)_120px_120px_190px_150px] items-center border-b border-[#edf0f2] px-5 py-4 text-sm last:border-b-0 hover:bg-[#fafbfc]"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#f2f3f5] text-[#59616d]"><Icon name="file" className="h-5 w-5" /></div><span className="truncate font-medium" title={dataset.name}>{dataset.name}</span></div><span>{getFileKind(dataset.extension)}</span><span className="text-[#68707c]">{formatBytes(dataset.size)}</span><span className="text-[#68707c]">{formatDate(dataset.createdAt)}</span><div className="flex justify-end gap-1"><button type="button" title="查看" onClick={() => setSelected(dataset)} className="flex h-8 w-8 items-center justify-center text-[#59616d] hover:bg-[#eceff2]"><Icon name="eye" /></button><button type="button" title="下载" onClick={() => handleDownload(dataset)} className="flex h-8 w-8 items-center justify-center text-[#59616d] hover:bg-[#eceff2]"><Icon name="download" /></button><button type="button" title="删除" onClick={() => handleDelete(dataset)} className="flex h-8 w-8 items-center justify-center text-[#d12f2f] hover:bg-[#fff0f0]"><Icon name="trash" /></button></div></div>)}</div>}
        </section>
      </main>
      {selected && <PreviewModal dataset={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

export default Datasets