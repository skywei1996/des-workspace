import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const CONNECTOR_STORAGE_KEY = 'des-connector-state'

const OAUTH_CONNECTORS = {
  gmail: {
    name: 'Gmail',
    appName: 'AI WorkMate',
    providerName: 'Google',
    logo: 'G',
    accent: '#ea4335',
    defaultEmail: 'ww1370141733@gmail.com',
    authCode: 'GOOGLE-GMAIL-OAUTH',
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

const writeConnectorState = (nextState) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CONNECTOR_STORAGE_KEY, JSON.stringify(nextState))
}

const getDetectedEmail = (connector) => {
  if (typeof window === 'undefined') return connector.defaultEmail

  const storedEmail = window.localStorage.getItem('des-browser-email')
  return storedEmail || connector.defaultEmail
}

function ConnectorOAuth() {
  const { connectorId } = useParams()
  const navigate = useNavigate()
  const connector = OAUTH_CONNECTORS[connectorId]

  if (!connector) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef2f7] px-4">
        <div className="rounded-[24px] bg-white px-8 py-7 text-center shadow-sm">
          <div className="text-lg font-semibold text-gray-950">连接应用不存在</div>
          <button type="button" onClick={() => navigate('/connectors')} className="mt-5 rounded-xl bg-[#eef0f3] px-4 py-2 text-sm font-semibold text-[#2f343d]">返回连接器</button>
        </div>
      </div>
    )
  }

  const detectedEmail = getDetectedEmail(connector)

  const handleConfirm = () => {
    const currentState = readConnectorState()
    const enterpriseConnectedIds = Array.isArray(currentState.enterpriseConnectedIds) ? currentState.enterpriseConnectedIds : []
    const personalAuthorizedIds = Array.isArray(currentState.personalAuthorizedIds) ? currentState.personalAuthorizedIds : []

    writeConnectorState({
      ...currentState,
      enterpriseConnectedIds: Array.from(new Set([...enterpriseConnectedIds, connectorId])),
      personalAuthorizedIds: Array.from(new Set([...personalAuthorizedIds, connectorId])),
      configs: {
        ...(currentState.configs || {}),
        [connectorId]: {
          ...(currentState.configs?.[connectorId] || {}),
          connectionMethod: 'oauth',
          connectedEmail: detectedEmail,
        },
      },
    })

    navigate('/connectors')
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#eef2f7] px-6 py-10 text-gray-950">
      <main className="mx-auto mt-20 w-full max-w-[1040px] rounded-[28px] bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4 text-sm text-gray-700">
          <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: connector.accent }}>{connector.logo}</div>
          <span>使用 {connector.providerName} 账号登录</span>
        </div>

        <section className="grid gap-8 px-9 py-8 md:grid-cols-[1fr_1.15fr]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: connector.accent }}>{connector.logo}</div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-gray-950">选择账号</h1>
            <p className="mt-5 text-base text-gray-600">继续前往 <span className="font-semibold text-gray-950">{connector.appName}</span></p>
          </div>

          <div className="pt-8">
            <button
              type="button"
              onClick={handleConfirm}
              className="flex w-full items-center gap-3 border-b border-gray-200 px-1 py-4 text-left transition hover:bg-gray-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">W</div>
              <div>
                <div className="text-sm font-semibold text-gray-950">wei wei</div>
                <div className="text-sm text-gray-500">{detectedEmail}</div>
              </div>
            </button>

            <button
              type="button"
              className="flex w-full items-center gap-3 border-b border-gray-200 px-1 py-4 text-left transition hover:bg-gray-50"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-400 text-sm text-gray-600">+</div>
              <div className="text-sm font-semibold text-gray-950">使用其他账号</div>
            </button>

            <p className="mt-10 text-sm leading-6 text-gray-500">继续即表示你确认将该 {connector.name} 账号连接到 {connector.appName}，用于访问邮件、联系人和相关个人上下文。</p>
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-6 flex w-full max-w-[980px] items-center justify-between px-4 text-xs text-gray-600">
        <button type="button" onClick={() => navigate('/connectors')} className="font-medium hover:text-gray-950">取消连接</button>
        <div className="flex gap-8">
          <span>帮助</span>
          <span>隐私权</span>
          <span>条款</span>
        </div>
      </footer>
    </div>
  )
}

export default ConnectorOAuth