import React from 'react'

const ActionIcon = ({ name }) => name === 'edit'
  ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>
  : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>

const RowActions = ({ item, type, onEdit, onDelete }) => (
  <div className="flex gap-1">
    <button type="button" onClick={() => onEdit(item, type)} title={`编辑${type === 'object' ? '对象' : '属性'}`} aria-label={`编辑${type === 'object' ? '对象' : '属性'} ${item.name}`} className="flex h-8 w-8 items-center justify-center rounded-md text-[#69727e] hover:bg-[#f1f3f5] hover:text-[#303741]"><ActionIcon name="edit" /></button>
    <button type="button" onClick={() => onDelete({ item, type })} title={`删除${type === 'object' ? '对象' : '属性'}`} aria-label={`删除${type === 'object' ? '对象' : '属性'} ${item.name}`} className="flex h-8 w-8 items-center justify-center rounded-md text-[#69727e] hover:bg-[#fff0ed] hover:text-[#d94338]"><ActionIcon name="delete" /></button>
  </div>
)

export function OntologyDefinitionList({ isProperties, objects, properties, onEdit, onDelete, onOpenResources }) {
  if (isProperties) {
    return <>
      <div className="mt-5 flex items-center justify-between gap-4 text-sm"><span className="font-medium text-[#353c46]">属性清单</span><span className="text-xs text-[#858d98]">已定义 {properties.length} 个属性</span></div>
      {properties.length ? <div className="mt-4 overflow-x-auto border border-[#e0e3e7]">
        <div className="grid min-w-[940px] grid-cols-[1.1fr_1fr_100px_1.5fr_1fr_80px] border-b border-[#e0e3e7] bg-[#fafbfc] px-4 py-3 text-xs font-semibold text-[#747d88]"><span>属性名称</span><span>已绑定对象</span><span>类型</span><span>业务说明</span><span>来源</span><span>操作</span></div>
        {properties.map((property) => <div key={property.id} className="grid min-w-[940px] grid-cols-[1.1fr_1fr_100px_1.5fr_1fr_80px] items-center border-b border-[#edf0f2] px-4 py-4 text-sm last:border-0"><span className="font-semibold text-[#303741]">{property.name}</span><span className="text-[#68717d]">{(property.objectIds || []).map((id) => objects.find((object) => object.id === id)?.name).filter(Boolean).join('、') || '未绑定'}</span><span className="text-[#68717d]">{property.dataType || '文本'}</span><span className="text-[#68717d]">{property.description || '暂无说明'}</span><span className="text-[#68717d]">{property.source || '待映射'}</span><RowActions item={property} type="property" onEdit={onEdit} onDelete={onDelete} /></div>)}
      </div> : <div className="mt-4 border border-dashed border-[#cfd5dc] bg-[#fafbfc] px-6 py-12 text-center text-sm text-[#858d98]">当前项目还没有定义属性</div>}
    </>
  }

  return <>
    <div className="mt-5 flex items-center justify-between gap-4 text-sm"><span className="font-medium text-[#353c46]">对象清单</span><span className="text-xs text-[#858d98]">已定义 {objects.length} 个对象</span></div>
    {objects.length ? <div className="mt-4 overflow-x-auto border border-[#e0e3e7]">
      <div className="grid min-w-[960px] grid-cols-[1.1fr_1fr_1.6fr_1fr_1fr] border-b border-[#e0e3e7] bg-[#fafbfc] px-4 py-3 text-xs font-semibold text-[#747d88]"><span>对象名称</span><span>业务标识</span><span>业务定义</span><span>负责人</span><span>操作</span></div>
      {objects.map((object) => <div key={object.id} className="grid min-w-[960px] grid-cols-[1.1fr_1fr_1.6fr_1fr_1fr] items-center border-b border-[#edf0f2] px-4 py-4 text-sm last:border-0"><span className="font-semibold text-[#303741]">{object.name}</span><span className="font-mono text-xs text-[#68717d]">{object.key}</span><span className="text-[#68717d]">{object.definition}</span><span className="text-[#68717d]">{object.owner}</span><span className="flex items-center gap-3"><button type="button" onClick={() => onOpenResources('property', object)} className="text-sm font-medium text-[#d94338]">属性</button><button type="button" onClick={() => onOpenResources('link', object)} className="text-sm font-medium text-[#d94338]">关联</button><RowActions item={object} type="object" onEdit={onEdit} onDelete={onDelete} /></span></div>)}
    </div> : <div className="mt-4 border border-dashed border-[#cfd5dc] bg-[#fafbfc] px-6 py-12 text-center text-sm text-[#858d98]">当前项目还没有定义对象</div>}
  </>
}
