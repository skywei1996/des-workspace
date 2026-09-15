import React from 'react'
import { Navigate, useParams } from 'react-router-dom'

const defaultRoutes = {
  hr: '/candidate-list',
  legal: '/contract-review-agent',
  content: '/watermark-audit-agent',
  platform: '/evaluation-agent',
}

const AgentAppRedirect = () => {
  const { projectKey } = useParams()
  return <Navigate to={defaultRoutes[projectKey] || '/agent-apps'} replace />
}

export default AgentAppRedirect
