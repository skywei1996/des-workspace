import { buildApiUrl } from '../config/api'

const CONTRACT_REVIEW_RULES_PATH = '/contract-review-rules'

const parseResponse = async (response) => {
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export const fetchContractRuleGroups = async () => {
  const response = await fetch(buildApiUrl(`${CONTRACT_REVIEW_RULES_PATH}/groups`))
  return parseResponse(response)
}

export const createContractRuleGroup = async ({ name }) => {
  const response = await fetch(buildApiUrl(`${CONTRACT_REVIEW_RULES_PATH}/groups`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return parseResponse(response)
}

export const fetchContractReviewRules = async () => {
  const response = await fetch(buildApiUrl(`${CONTRACT_REVIEW_RULES_PATH}/rules`))
  return parseResponse(response)
}

export const createContractReviewRule = async ({ name, risk, description, groupName }) => {
  const response = await fetch(buildApiUrl(`${CONTRACT_REVIEW_RULES_PATH}/rules`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, risk, description, group_name: groupName }),
  })
  return parseResponse(response)
}

export const fetchContractRuleAnalyses = async (ruleId) => {
  const response = await fetch(buildApiUrl(`${CONTRACT_REVIEW_RULES_PATH}/rules/${ruleId}/analyses`))
  return parseResponse(response)
}

export const createContractRuleAnalyses = async ({ ruleId, contracts }) => {
  const response = await fetch(buildApiUrl(`${CONTRACT_REVIEW_RULES_PATH}/rules/${ruleId}/analyses`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contracts }),
  })
  return parseResponse(response)
}
