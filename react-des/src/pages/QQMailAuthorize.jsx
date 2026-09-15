import React, { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { buildApiUrl } from '../config/api'

const CONNECTOR_STORAGE_KEY = 'des-connector-state'

const getDetectedQQMail = () => {
  if (typeof window === 'undefined') return 'workmate@qq.com'
  const stored = window.localStorage.getItem('des-browser-email') || ''
  if (/@(qq\.com|vip\.qq\.com|foxmail\.com)$/i.test(stored.trim())) {
    return stored.trim()
  }
  return '1370141733@qq.com'
}

function QQMailAuthorize() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('sessionId') || ''
  const detectedEmail = useMemo(() => getDetectedQQMail(), [])
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleAuthorize = async () => {
    setIsAuthorizing(true)
    setErrorMessage('')

    if (sessionId.startsWith('local-')) {
      try {
        const raw = window.localStorage.getItem(CONNECTOR_STORAGE_KEY)
        const currentState = raw ? JSON.parse(raw) : {}
        const enterpriseConnectedIds = Array.isArray(currentState.enterpriseConnectedIds) ? currentState.enterpriseConnectedIds : []
        const personalAuthorizedIds = Array.isArray(currentState.personalAuthorizedIds) ? currentState.personalAuthorizedIds : []

        window.localStorage.setItem(CONNECTOR_STORAGE_KEY, JSON.stringify({
          ...currentState,
          enterpriseConnectedIds: Array.from(new Set([...enterpriseConnectedIds, 'qqmail'])),
          personalAuthorizedIds: Array.from(new Set([...personalAuthorizedIds, 'qqmail'])),
          configs: {
            ...(currentState.configs || {}),
            qqmail: {
              ...(currentState.configs?.qqmail || {}),
              connectionMethod: 'mail',
              connectedEmail: detectedEmail,
            },
          },
        }))
        navigate('/connectors')
      } catch (error) {
        setErrorMessage('QQ 邮箱授权失败。')
        setIsAuthorizing(false)
      }
      return
    }

    try {
      const response = await fetch(buildApiUrl('/connectors/email/qq-mail/auth/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, email: detectedEmail }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.detail || 'QQ 邮箱授权失败。')
      }

      navigate('/connectors')
    } catch (error) {
      setErrorMessage(error.message || 'QQ 邮箱授权失败。')
    } finally {
      setIsAuthorizing(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#eef2f7] px-6 py-10 text-gray-950">
      <main className="mx-auto mt-20 w-full max-w-[1040px] rounded-[28px] bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4 text-sm text-gray-700">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#12b7f5] text-xs font-bold text-white">Q</div>
          <span>使用 QQ 邮箱账号授权</span>
        </div>

        <section className="grid gap-8 px-9 py-8 md:grid-cols-[1fr_1.15fr]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#12b7f5] text-sm font-bold text-white">Q</div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-gray-950">选择账号</h1>
            <p className="mt-5 text-base text-gray-600">继续前往 <span className="font-semibold text-gray-950">AI WorkMate</span></p>
          </div>

          <div className="pt-8">
            <button
              type="button"
              onClick={handleAuthorize}
              disabled={isAuthorizing || !sessionId}
              className="flex w-full items-center gap-3 border-b border-gray-200 px-1 py-4 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#12b7f5] text-sm font-semibold text-white">Q</div>
              <div>
                <div className="text-sm font-semibold text-gray-950">QQ 邮箱账号</div>
                <div className="text-sm text-gray-500">{detectedEmail}</div>
              </div>
            </button>

            <button
              type="button"
              className="flex w-full items-center gap-3 border-b border-gray-200 px-1 py-4 text-left transition hover:bg-gray-50"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-400 text-sm text-gray-600">+</div>
              <div className="text-sm font-semibold text-gray-950">使用其他 QQ 邮箱账号</div>
            </button>

            {errorMessage && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>}
            {!sessionId && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">授权会话不存在，请返回后重新连接。</div>}
            <p className="mt-10 text-sm leading-6 text-gray-500">继续即表示你同意将该 QQ 邮箱账号授权给 AI WorkMate，用于邮件检索、摘要和重要邮件提醒。</p>
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-6 flex w-full max-w-[980px] items-center justify-between px-4 text-xs text-gray-600">
        <button type="button" onClick={() => navigate('/connectors')} className="font-medium hover:text-gray-950">取消授权</button>
        <div className="flex gap-8">
          <span>帮助</span>
          <span>隐私权</span>
          <span>条款</span>
        </div>
      </footer>
    </div>
  )
}

export default QQMailAuthorize