import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import { API_BASE } from '../config/api'

const CreateSkillOptionModal = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null

  const options = [
    {
      key: 'mcp',
      title: 'MCP Skill',
      description: 'Create a skill that binds MCP toolsets and decides when to call external tools.',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L15 12l-5.25-5M4 12h11" />
        </svg>
      ),
      accent: 'border-[#f3d4cf] bg-[#fff7f4] text-[#d54d3f] hover:border-[#efb4ad] hover:bg-[#fff1ed]',
    },
    {
      key: 'workflow',
      title: 'Workflow Skill',
      description: 'Create a multi-step workflow with handoff logic, orchestration, and optional AI-generated draft steps.',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 7h12M6 12h12M6 17h7" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 17l2 2 4-4" />
        </svg>
      ),
      accent: 'border-[#ecdca6] bg-[#fff9ea] text-[#b7791f] hover:border-[#e4c96e] hover:bg-[#fff4cf]',
    },
  ]

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-gray-900">Choose Skill Type</div>
            <div className="mt-2 text-sm leading-6 text-gray-500">Select the kind of skill you want to create. The editor will open directly in that mode.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onSelect(option.key)}
              className={`rounded-[24px] border p-5 text-left transition ${option.accent}`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                {option.icon}
              </div>
              <div className="mt-5 text-lg font-semibold text-gray-900">{option.title}</div>
              <div className="mt-2 text-sm leading-6 text-gray-600">{option.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const EmptyState = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-[#f0c9c4] bg-white px-6 py-14 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff1ee] text-[#e3473c]">
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v12m6-6H6" />
      </svg>
    </div>
    <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
    <p className="mt-2 text-sm text-gray-500">{description}</p>
  </div>
)

const SkillCard = ({ skill, onOpen, onToggleEnabled, onDelete, busy }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={() => onOpen(skill.skill_key)}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onOpen(skill.skill_key)
      }
    }}
    className="group relative flex h-full cursor-pointer flex-col rounded-[18px] border border-[#ececef] bg-white p-5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#dddfe4] hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 pr-3">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-lg font-bold text-gray-900">{skill.name}</h3>
          {!skill.readonly && skill.enabled && (
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          )}
        </div>
        <p className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-5 text-gray-500">
          {skill.description || 'No description provided yet.'}
        </p>
      </div>

      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${skill.skill_type === 'mcp' ? 'bg-[#fff1ee] text-[#e3473c]' : skill.skill_type === 'workflow' ? 'bg-amber-50 text-amber-600' : 'bg-[#fff4f2] text-[#d54d3f]'}`}>
        {skill.skill_type === 'mcp' ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L15 12l-5.25-5M4 12h11" />
          </svg>
        ) : skill.skill_type === 'workflow' ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 7h12M6 12h12M6 17h7" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 17l2 2 4-4" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96.44 2.5 2.5 0 01-2.96-3.08 3 3 0 01-.34-5.58 2.5 2.5 0 011.32-4.24 2.5 2.5 0 011.98-3A2.5 2.5 0 019.5 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.5 2A2.5 2.5 0 0012 4.5v15a2.5 2.5 0 004.96.44 2.5 2.5 0 002.96-3.08 3 3 0 00.34-5.58 2.5 2.5 0 00-1.32-4.24 2.5 2.5 0 00-1.98-3A2.5 2.5 0 0014.5 2z" />
          </svg>
        )}
      </div>
    </div>

    <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs text-gray-400">
      <span>{skill.skill_type === 'mcp' ? (skill.mcp_server?.name || 'No MCP toolset') : skill.skill_type === 'workflow' ? `${skill.workflow_steps?.length || 0} configured steps` : ''}</span>
      {skill.readonly ? (
        <span className="font-medium text-amber-600">Built-in skill</span>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation()
              onToggleEnabled(skill)
            }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {skill.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation()
              onDelete(skill)
            }}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  </div>
)

const formatImpactNames = (items = [], emptyLabel = 'None') => {
  if (!items.length) return emptyLabel
  if (items.length <= 5) return items.join('、')
  return `${items.slice(0, 5).join('、')} 等 ${items.length} 项`
}

const Tools = () => {
  const navigate = useNavigate()
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingSkillKey, setSavingSkillKey] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, skill: null, sections: [] })

  const loadData = async () => {
    setLoading(true)
    try {
      const skillsResponse = await fetch(`${API_BASE}/skills/`)
      const skillsPayload = await skillsResponse.json()
      const nextSkills = skillsPayload?.data?.skills || []
      setSkills(nextSkills)
    } catch (error) {
      console.error('Failed to load skill data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const target = `${skill.skill_key || ''} ${skill.name || ''} ${skill.description || ''}`.toLowerCase()
      return target.includes(searchQuery.toLowerCase())
    })
  }, [skills, searchQuery])

  const openSkill = (skillKey) => {
    navigate(`/tools/${skillKey}`)
  }

  const loadSkill = async (skillKey) => {
    const response = await fetch(`${API_BASE}/skills/${skillKey}`)
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(payload?.detail || 'Failed to load skill details')
    }
    return payload?.data || null
  }

  const handleToggleEnabled = async (skill) => {
    if (!skill || skill.readonly) return

    setSavingSkillKey(skill.skill_key)
    try {
      const detail = await loadSkill(skill.skill_key)
      const response = await fetch(`${API_BASE}/skills/${skill.skill_key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: detail?.name || skill.name,
          description: detail?.description || skill.description || '',
          skill_type: detail?.skill_type || skill.skill_type || 'prompt',
          instructions: detail?.instructions || '',
          workflow_steps: detail?.workflow_steps || [],
          mcp_server_id: detail?.mcp_server_id ?? null,
          enabled: !skill.enabled,
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text() || 'Failed to update skill status')
      }

      await loadData()
    } catch (error) {
      alert(error.message)
    } finally {
      setSavingSkillKey('')
    }
  }

  const handleDelete = async (skill) => {
    if (!skill || skill.readonly) return

    let impactedEmployees = []
    try {
      const response = await fetch(`${API_BASE}/ai-employees/`)
      const employees = await response.json().catch(() => [])
      if (response.ok && Array.isArray(employees)) {
        impactedEmployees = employees
          .filter((employee) => Array.isArray(employee?.tool_ids) && employee.tool_ids.includes(skill.skill_key))
          .map((employee) => employee.name || `Employee ${employee.id}`)
      }
    } catch (error) {
      console.error('Failed to load skill impact range:', error)
    }

    setDeleteDialog({
      open: true,
      skill,
      sections: [
        { label: '影响范围', value: `受影响数字员工：${formatImpactNames(impactedEmployees)}` },
      ],
    })
  }

  const handleConfirmDelete = async () => {
    const skill = deleteDialog.skill
    if (!skill) return

    setSavingSkillKey(skill.skill_key)
    try {
      const response = await fetch(`${API_BASE}/skills/${skill.skill_key}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(await response.text() || 'Failed to delete skill')
      }

      await loadData()
    } catch (error) {
      alert(error.message)
    } finally {
      setSavingSkillKey('')
      setDeleteDialog({ open: false, skill: null, sections: [] })
    }
  }

  const handleSelectCreateOption = (option) => {
    setIsCreateModalOpen(false)
    navigate(`/tools/new?type=${option}`)
  }

  const handleImportSkill = (type = 'prompt') => {
    const params = new URLSearchParams({ mode: 'import' })
    if (type === 'workflow') {
      params.set('type', 'workflow')
    }
    navigate(`/tools/new?${params.toString()}`)
  }

  return (
    <div className="flex min-h-screen bg-[#f6f6f8] text-gray-900">
      <Sidebar />
      <DeleteConfirmModal
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, skill: null, sections: [] })}
        onConfirm={handleConfirmDelete}
        title={deleteDialog.skill ? `删除 Skill ${deleteDialog.skill.name}？` : '删除 Skill'}
        description="删除后，该 Skill 会从系统中移除，以上数字员工将无法继续调用该 Skill 执行任务；历史执行记录会继续保留。"
        descriptionTone="danger"
        sections={deleteDialog.sections}
        confirmLabel="确认删除"
        isSubmitting={Boolean(deleteDialog.skill && savingSkillKey === deleteDialog.skill.skill_key)}
      />
      <CreateSkillOptionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSelect={handleSelectCreateOption}
      />

      <div className="flex-1 overflow-hidden">
        <div className="flex h-screen flex-col">
          <header className="border-b border-[#ececef] bg-white px-8 py-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Skills</h1>
                <p className="mt-1 text-sm text-gray-500">Transform business actions into reusable skills, giving digital employees real operational capabilities.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleImportSkill('prompt')}
                  className="rounded-full border border-[#f1c8c2] bg-white px-4 py-2.5 text-sm font-medium text-[#d54d3f] transition hover:border-[#e9a9a0] hover:bg-[#fff5f2]"
                >
                  Import Skill
                </button>
                <button
                  type="button"
                  onClick={() => handleImportSkill('workflow')}
                  className="rounded-full border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-amber-700 transition hover:border-amber-300 hover:bg-amber-50"
                >
                  Import Workflow Skill
                </button>
                <button onClick={() => setIsCreateModalOpen(true)} className="rounded-full bg-[#f40b0b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#de1010]">
                  New Skill
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-10 py-6">
            <section className="mb-8">
              <div className="relative max-w-md">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search skills by name"
                  className="w-full rounded-xl border border-[#e5e7eb] bg-[#fbfbfc] py-2.5 pl-10 pr-4 text-sm text-[#434854] outline-none transition focus:border-[#f0bbb6] focus:bg-white focus:ring-4 focus:ring-[#fff1ef]"
                />
              </div>
            </section>

            <section className="mt-8">
              {loading ? (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <div key={item} className="h-52 animate-pulse rounded-[18px] border border-[#ececef] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                      <div className="h-5 w-32 rounded bg-gray-200" />
                      <div className="mt-4 h-4 w-full rounded bg-gray-100" />
                      <div className="mt-2 h-4 w-3/4 rounded bg-gray-100" />
                      <div className="mt-8 flex gap-2">
                        <div className="h-7 w-20 rounded-full bg-gray-100" />
                        <div className="h-7 w-20 rounded-full bg-gray-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredSkills.length === 0 ? (
                <EmptyState title="No skills matched" description="Adjust the search or filters, or create a new skill to extend the registry." />
              ) : (
                <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
                  {filteredSkills.map((skill) => (
                    <SkillCard
                      key={skill.skill_key}
                      skill={skill}
                      onOpen={openSkill}
                      onToggleEnabled={handleToggleEnabled}
                      onDelete={handleDelete}
                      busy={savingSkillKey === skill.skill_key}
                    />
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Tools
