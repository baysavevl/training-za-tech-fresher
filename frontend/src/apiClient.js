import { handleStaticDemoRequest, shouldUseStaticDemoBackend } from './staticDemoBackend.js'

export function withJsonHeaders(options = {}) {
  return {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  }
}

export async function requestJson(path, options = {}) {
  if (shouldUseStaticDemoBackend() && (path.startsWith('/api/') || path.startsWith('/actuator/'))) {
    return handleStaticDemoRequest(path, withJsonHeaders(options))
  }

  const response = await fetch(apiUrl(path), withJsonHeaders(options))
  const raw = await response.text()
  const body = raw ? JSON.parse(raw) : null
  if (!response.ok) {
    throw new Error(body?.message || `${response.status} ${response.statusText}`)
  }
  return body
}

export async function readTrainingSource(path) {
  if (!shouldUseStaticDemoBackend()) {
    const response = await fetch(apiUrl(`/api/training/sources?path=${encodeURIComponent(path)}`), withJsonHeaders())
    const body = await response.json()
    if (!response.ok) {
      throw new Error(body?.message || `${response.status} ${response.statusText}`)
    }
    return body
  }

  const response = await fetch(`https://raw.githubusercontent.com/baysavevl/training-za-tech-fresher/main/${path}`)
  if (!response.ok) {
    return {
      path,
      language: languageFor(path),
      content: `Static Vercel demo could not fetch this source file from GitHub.\n\nPath: ${path}\n\nRun the Java backend locally for the repository source API, or open this path directly in the repository.`
    }
  }
  return {
    path,
    language: languageFor(path),
    content: await response.text()
  }
}

function apiUrl(path) {
  const baseUrl = import.meta.env?.VITE_API_BASE_URL || ''
  return `${baseUrl}${path}`
}

function languageFor(path) {
  if (path.endsWith('.java')) return 'java'
  if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.jsx')) return 'javascript'
  if (path.endsWith('.md')) return 'markdown'
  if (path.endsWith('.sql')) return 'sql'
  if (path.endsWith('.yml') || path.endsWith('.yaml')) return 'yaml'
  return 'text'
}
