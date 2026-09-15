import JSZip from 'jszip'

const SUPPORTED_SKILL_TYPES = new Set(['prompt', 'mcp', 'workflow'])

const normalizeLineEndings = (value) => String(value || '').replace(/\r\n/g, '\n')

const stripWrappingQuotes = (value) => {
  const trimmed = String(value || '').trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

const deriveSkillNameFromText = (content, fallbackName) => {
  const headingMatch = normalizeLineEndings(content).match(/^#\s+(.+)$/m)
  if (headingMatch?.[1]) {
    return headingMatch[1].trim()
  }

  return fallbackName
}

const deriveSkillNameFromFileName = (fileName) => {
  const rawName = String(fileName || '')
    .replace(/\.(zip|md|markdown|txt)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()

  if (!rawName) {
    return 'Imported Skill'
  }

  return rawName
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

const extractFrontmatter = (source) => {
  const normalized = normalizeLineEndings(source)
  if (!normalized.startsWith('---\n')) {
    return { attributes: {}, content: normalized.trim() }
  }

  const closingIndex = normalized.indexOf('\n---\n', 4)
  if (closingIndex === -1) {
    return { attributes: {}, content: normalized.trim() }
  }

  const header = normalized.slice(4, closingIndex)
  const content = normalized.slice(closingIndex + 5)
  const attributes = {}

  header.split('\n').forEach((line) => {
    if (!line || /^\s/.test(line)) {
      return
    }

    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) {
      return
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()

    if (!key) {
      return
    }

    attributes[key] = stripWrappingQuotes(value)
  })

  return {
    attributes,
    content: content.trim(),
  }
}

const findSkillEntryInZip = (zip) => {
  const files = Object.values(zip.files).filter((entry) => !entry.dir)

  return (
    files.find((entry) => /(^|\/)SKILL\.md$/i.test(entry.name))
    || files.find((entry) => /(^|\/)skill\.md$/i.test(entry.name))
    || files.find((entry) => /\.md$/i.test(entry.name))
    || null
  )
}

const readImportedSource = async (file) => {
  const lowerName = String(file?.name || '').toLowerCase()

  if (lowerName.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file)
    const skillEntry = findSkillEntryInZip(zip)

    if (!skillEntry) {
      throw new Error('The ZIP package did not contain a SKILL.md file.')
    }

    return skillEntry.async('string')
  }

  return file.text()
}

export const parseImportedSkillFile = async (file) => {
  if (!file || typeof file.text !== 'function') {
    throw new Error('Please choose a valid skill file.')
  }

  const source = await readImportedSource(file)
  const { attributes, content } = extractFrontmatter(source)
  const fallbackName = deriveSkillNameFromFileName(file.name)
  const normalizedSkillType = String(attributes.skill_type || '').trim().toLowerCase()

  return {
    fileName: file.name,
    name: attributes.name || deriveSkillNameFromText(content, fallbackName),
    description: attributes.description || '',
    instructions: content,
    skillType: SUPPORTED_SKILL_TYPES.has(normalizedSkillType) ? normalizedSkillType : 'prompt',
  }
}