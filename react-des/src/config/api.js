const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim()

export const API_BASE = configuredApiBase

export const buildApiUrl = (path = '') => {
	if (!path) return API_BASE
	if (/^https?:\/\//i.test(path)) return path

	const normalizedPath = path.startsWith('/') ? path : `/${path}`
	return `${API_BASE}${normalizedPath}`
}