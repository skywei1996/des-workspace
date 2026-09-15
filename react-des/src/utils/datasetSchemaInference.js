import * as XLSX from 'xlsx'
import { readDatasetWorkbook } from './datasetWorkbook'

const normalizeApiName = (value, fallback) => {
  const words = String(value || '')
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)

  if (!words.length) return fallback
  const [first, ...rest] = words
  const candidate = `${first.toLowerCase()}${rest.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join('')}`
  return /^[a-z]/.test(candidate) ? candidate : fallback
}

const inferDataType = (values) => {
  const populated = values.filter((value) => value !== '' && value !== null && value !== undefined)
  if (!populated.length) return '文本'

  if (populated.every((value) => typeof value === 'boolean' || /^(true|false|是|否)$/i.test(String(value)))) return '布尔'
  if (populated.every((value) => typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value).trim()))) return '数字'
  if (populated.every((value) => value instanceof Date || (!Number.isNaN(Date.parse(String(value))) && /[-/:年月日]/.test(String(value))))) return '日期'

  const uniqueCount = new Set(populated.map((value) => String(value).trim())).size
  if (populated.length >= 3 && uniqueCount <= Math.min(20, Math.ceil(populated.length * 0.35))) return '枚举'
  return '文本'
}

const buildDisplayName = (fileName) => {
  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return baseName || '新对象类型'
}

const COLUMN_SEMANTICS = {
  available_calendars: ['可用日历', '可用日历列表。'],
  assigned_orders: ['已分配订单', '已分配的订单列表。'],
  capacity_per_day: ['每日产能', '每日可处理的业务数量或产能。'],
  department: ['部门', '所属部门。'],
  order_id: ['订单唯一标识', '订单记录的唯一标识。'],
  customer: ['客户', '与当前记录关联的客户信息。'],
  product_list: ['产品列表', '当前订单包含的产品列表。'],
  quantity: ['数量', '当前记录对应的业务数量。'],
  priority: ['优先级', '当前记录的业务优先级。'],
  project_id: ['项目唯一标识', '项目的唯一标识。'],
  project_code: ['项目编码', '项目的业务编码。'],
  project_name: ['项目名称', '项目的名称。'],
  project_manager: ['项目经理', '负责该项目的经理。'],
  customer_name: ['客户名称', '项目所属客户的名称。'],
  budget_amount: ['预算金额', '项目的预算金额。'],
  start_date: ['开始日期', '项目的开始日期。'],
  end_date: ['结束日期', '项目的结束日期。'],
  material_id: ['物料唯一标识', '物料记录的唯一标识。'],
  material_code: ['物料编码', '物料的业务编码。'],
  material_name: ['物料名称', '物料的中文名称。'],
  material_category: ['物料类别', '物料所属的分类。'],
  spec_model: ['规格型号', '物料的规格或型号。'],
  manufacturer: ['制造商', '物料的生产制造商。'],
  unit: ['计量单位', '物料使用的计量单位。'],
  linked_commodity_code: ['关联商品编码', '与物料关联的商品编码。'],
  standard_material_weight: ['标准物料重量', '物料的标准重量。'],
  scrap_rate: ['废料率', '生产过程中产生废料的比例。'],
  status: ['状态', '当前记录的业务状态。'],
  quotation_id: ['报价单唯一标识', '报价单的唯一标识。'],
  quotation_no: ['报价单编号', '报价单的业务编号。'],
  quotation_time: ['报价时间', '报价单的报价时间。'],
  quotation_date: ['报价日期', '报价单的报价日期。'],
  rfq_id: ['询价单唯一标识', '询价单的唯一标识。'],
  rfq_no: ['询价单编号', '询价单的业务编号。'],
  rfq_time: ['询价时间', '询价单的发起时间。'],
  rfq_date: ['询价日期', '询价单的发起日期。'],
  supplier_id: ['供应商唯一标识', '供应商的唯一标识。'],
  supplier_code: ['供应商编码', '供应商的业务编码。'],
  supplier_name: ['供应商名称', '供应商的名称。'],
  line_id: ['明细唯一标识', '明细记录的唯一标识。'],
  line_no: ['明细行号', '明细记录的行号。'],
  currency: ['币种', '报价使用的币种。'],
  tax_rate: ['税率', '报价适用的税率。'],
  freight_term: ['运费条款', '报价适用的运费条款。'],
  payment_term: ['付款条款', '报价约定的付款条款。'],
  delivery_date: ['交付日期', '约定的交付日期。'],
  delivery_term: ['交付条款', '约定的交付条款。'],
  unit_price: ['单价', '物料或商品的单位价格。'],
  total_amount: ['总金额', '当前记录的总金额。'],
}

const COLUMN_TOKEN_LABELS = {
  id: '唯一标识', code: '编码', no: '编号', number: '编号', name: '名称', title: '标题',
  order: '订单', project: '项目', material: '物料', commodity: '商品', product: '产品', list: '列表', category: '类别', type: '类型',
  spec: '规格', model: '型号', manufacturer: '制造商', supplier: '供应商', customer: '客户', manager: '经理',
  unit: '单位', standard: '标准', weight: '重量', quantity: '数量', amount: '金额',
  price: '价格', rate: '比率', ratio: '比例', scrap: '废料', status: '状态', priority: '优先级',
  date: '日期', time: '时间', created: '创建', updated: '更新', linked: '关联',
  description: '说明', remark: '备注', address: '地址', phone: '电话', email: '邮箱',
  quotation: '报价单', quote: '报价', rfq: '询价单', line: '明细', freight: '运费',
  payment: '付款', delivery: '交付', currency: '币种', tax: '税', total: '总计',
  available: '可用', calendar: '日历', calendars: '日历', assigned: '已分配', orders: '订单', capacity: '产能', per: '每', day: '日', department: '部门',
}

export const inferColumnSemantics = (columnName) => {
  const sourceName = String(columnName || '').trim()
  const normalized = sourceName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  const exactMatch = COLUMN_SEMANTICS[normalized]
  if (exactMatch) return { name: exactMatch[0], description: exactMatch[1] }

  const sourceContainsChinese = /[^\x00-\xff]/.test(sourceName)
  const sourceTokens = normalized.split('_').filter(Boolean)
  const translatedTokens = sourceTokens.map((token) => COLUMN_TOKEN_LABELS[token]).filter(Boolean)
  const translatedName = sourceContainsChinese
    ? sourceName.replace(/[A-Za-z_]+/g, '').trim()
    : translatedTokens.join('')
  const descriptionBySuffix = [
    ['唯一标识', `${translatedName.replace(/唯一标识$/, '') || '记录'}的唯一标识。`],
    ['编码', `${translatedName.replace(/编码$/, '') || '记录'}的业务编码。`],
    ['编号', `${translatedName.replace(/编号$/, '') || '记录'}的业务编号。`],
    ['名称', `${translatedName.replace(/名称$/, '') || '记录'}的名称。`],
    ['状态', `${translatedName.replace(/状态$/, '') || '记录'}的业务状态。`],
    ['日期', `${translatedName.replace(/日期$/, '') || '记录'}的日期。`],
    ['时间', `${translatedName.replace(/时间$/, '') || '记录'}的时间。`],
    ['数量', `${translatedName.replace(/数量$/, '') || '记录'}的数量。`],
    ['金额', `${translatedName.replace(/金额$/, '') || '记录'}的金额。`],
    ['重量', `${translatedName.replace(/重量$/, '') || '记录'}的重量。`],
    ['比率', `${translatedName.replace(/比率$/, '') || '记录'}的比率。`],
    ['比例', `${translatedName.replace(/比例$/, '') || '记录'}的比例。`],
    ['列表', `${translatedName.replace(/列表$/, '') || '记录'}包含的列表信息。`],
    ['优先级', `${translatedName.replace(/优先级$/, '') || '记录'}的业务优先级。`],
  ]
  const matchedDescription = descriptionBySuffix.find(([suffix]) => translatedName.endsWith(suffix))
  return {
    name: translatedName || sourceName || '业务字段',
    description: matchedDescription?.[1] || (translatedName ? `${translatedName}。` : `${sourceName || '业务字段'}。`),
  }
}

const scorePrimaryKey = (column) => {
  const name = column.name.toLowerCase()
  let score = column.uniqueRate === 1 ? 50 : 0
  if (/(^|[_\s-])(id|code|key|no|number)([_\s-]|$)/i.test(name) || /(编号|编码|主键|唯一标识)/.test(column.name)) score += 40
  if (column.nonEmptyRate === 1) score += 10
  return score
}

const scoreTitleKey = (column) => {
  const name = column.name.toLowerCase()
  let score = column.dataType === '文本' ? 20 : 0
  if (/(name|title|label|subject)/i.test(name) || /(名称|姓名|标题|主题)/.test(column.name)) score += 70
  if (column.nonEmptyRate >= 0.8) score += 10
  return score
}

export const inferDatasetSchema = async (dataset) => {
  const extension = dataset.extension?.toLowerCase()
  if (!['xlsx', 'xls', 'csv'].includes(extension)) {
    throw new Error('PDF 请使用文档语义分析；Excel 和 CSV 使用列结构抽取。')
  }

  const workbook = await readDatasetWorkbook(dataset, { cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true })
  const headers = (rows[0] || []).map((value, index) => String(value || `字段 ${index + 1}`).trim())
  const dataRows = rows.slice(1, 201)

  if (!headers.length) throw new Error('数据集没有可识别的列。')

  const columns = headers.map((columnName, columnIndex) => {
    const values = dataRows.map((row) => row[columnIndex]).filter((value) => value !== undefined)
    const populated = values.filter((value) => value !== '' && value !== null)
    const uniqueCount = new Set(populated.map((value) => String(value).trim())).size
    const semantics = inferColumnSemantics(columnName)
    return {
      id: `property-${columnIndex + 1}`,
      name: columnName,
      apiName: normalizeApiName(columnName, `property${columnIndex + 1}`),
      description: semantics.description,
      dataType: inferDataType(values),
      source: 'datasource',
      sourceName: `${dataset.name} / ${sheetName} / ${columnName}`,
      datasetId: dataset.id,
      datasetName: dataset.name,
      sheetName,
      columnName,
      nonEmptyRate: dataRows.length ? populated.length / dataRows.length : 0,
      uniqueRate: populated.length ? uniqueCount / populated.length : 0,
      sampleValues: populated.slice(0, 3).map(String),
    }
  })

  const primaryKey = [...columns].sort((left, right) => scorePrimaryKey(right) - scorePrimaryKey(left))[0]
  const titleKey = [...columns]
    .filter((column) => column.id !== primaryKey?.id)
    .sort((left, right) => scoreTitleKey(right) - scoreTitleKey(left))[0] || primaryKey
  const displayName = buildDisplayName(dataset.name)

  return {
    displayName,
    description: `基于数据集“${dataset.name}”的 ${sheetName} 工作表自动生成，包含 ${columns.length} 个属性。`,
    properties: columns,
    primaryKeyId: primaryKey?.id || '',
    titleKeyId: titleKey?.id || '',
    sheetName,
    rowCount: Math.max(rows.length - 1, 0),
  }
}

export const readDatasetRows = async (dataset) => {
  const extension = dataset.extension?.toLowerCase()
  if (!['xlsx', 'xls', 'csv'].includes(extension)) return []

  const workbook = await readDatasetWorkbook(dataset, { cellDates: true })
  const sheetName = workbook.SheetNames[0]
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: true })
}