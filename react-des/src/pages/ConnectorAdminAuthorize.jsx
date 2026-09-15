import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const CONNECTOR_STORAGE_KEY = 'des-connector-state'

const ADMIN_CONNECTORS = {
  feishu: {
    name: '飞书',
    accent: '#3370ff',
    initials: '飞',
  },
  dingtalk: {
    name: '钉钉',
    accent: '#1683ff',
    initials: '钉',
  },
}

const readConnectorState = () => {
  if (typeof window === 'undefined') return {}

  try {
    const parsed = JSON.parse(window.localStorage.getItem(CONNECTOR_STORAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (error) {
    console.error('Failed to read connector state:', error)
    return {}
  }
}

function ConnectorAdminAuthorize() {
  const { connectorId } = useParams()
  const navigate = useNavigate()
  const connector = ADMIN_CONNECTORS[connectorId]

  const handleAuthorize = () => {
    if (!connectorId) return

    const currentState = readConnectorState()
    const adminAuthorizedIds = Array.isArray(currentState.adminAuthorizedIds) ? currentState.adminAuthorizedIds : []
    const enterpriseConnectedIds = Array.isArray(currentState.enterpriseConnectedIds) ? currentState.enterpriseConnectedIds : []

    window.localStorage.setItem(CONNECTOR_STORAGE_KEY, JSON.stringify({
      ...currentState,
      adminAuthorizedIds: Array.from(new Set([...adminAuthorizedIds, connectorId])),
      enterpriseConnectedIds: Array.from(new Set([...enterpriseConnectedIds, connectorId])),
    }))

    navigate('/connectors')
  }

  if (!connector) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef2f7] px-4">
        <div className="rounded-[24px] bg-white px-8 py-7 text-center shadow-sm">
          <div className="text-lg font-semibold text-gray-950">授权应用不存在</div>
          <button type="button" onClick={() => navigate('/connectors')} className="mt-5 rounded-xl bg-[#eef0f3] px-4 py-2 text-sm font-semibold text-[#2f343d]">返回连接器</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#eef2f7] px-6 py-10 text-gray-950">
      <main className="mx-auto mt-20 w-full max-w-[720px] rounded-[28px] bg-white p-8 text-center shadow-sm">
        <div className="flex items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold text-white" style={{ backgroundColor: connector.accent }}>{connector.initials}</div>
            <div className="text-xl font-semibold text-gray-800">{connector.name} 管理员授权</div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/connectors')}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            关闭
          </button>
        </div>

        <div className="mt-16 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-[28px] text-3xl font-bold text-white shadow-sm" style={{ backgroundColor: connector.accent }}>{connector.initials}</div>
        </div>
        <h1 className="mt-10 text-4xl font-semibold tracking-tight text-gray-950">登录管理员账号</h1>
        <p className="mt-6 text-lg leading-8 text-gray-500">使用企业管理员 {connector.name} 账号登录，授权 WorkMate 使用企业能力。</p>

        <button
          type="button"
          onClick={handleAuthorize}
          className="mt-12 w-full rounded-2xl border border-[#d7dbe2] bg-[#eef0f3] px-5 py-4 text-lg font-semibold text-[#2f343d] transition hover:bg-[#e4e7ec]"
        >
          模拟登录并授权
        </button>
      </main>
    </div>
  )
}

export default ConnectorAdminAuthorize