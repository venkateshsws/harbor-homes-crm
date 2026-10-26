
let csrfToken = null

export function setCsrfToken(token) {
  csrfToken = token || null
}

export function getCsrfToken() {
  return csrfToken
}

export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const body = options.body
  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData

  const headers = {
    Accept: 'application/json',
    ...(body != null && !isFormData
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(options.headers || {}),
  }

  // Add CSRF protection to requests that can modify data.
  if (
    csrfToken &&
    !['GET', 'HEAD', 'OPTIONS'].includes(method)
  ) {
    headers['X-CSRF-Token'] = csrfToken
  }

  const requestOptions = {
    ...options,
    method,
    credentials: 'include',
    headers,
  }

  // Serialize JSON bodies but leave FormData unchanged.
  if (body != null && !isFormData) {
    requestOptions.body =
      typeof body === 'string' ? body : JSON.stringify(body)
  } else {
    requestOptions.body = body
  }

  let response

  try {
    response = await fetch(path, requestOptions)
  } catch (error) {
    const networkError = new Error(
      'Unable to connect to the server. Check that the backend is running and the API URL is correct.',
    )
    networkError.cause = error
    throw networkError
  }

  // Handle responses that contain no JSON body.
  const contentType = response.headers.get('content-type') || ''
  let data = {}

  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}))
  } else if (response.status !== 204) {
    const text = await response.text().catch(() => '')
    data = text ? { message: text } : {}
  }

  if (!response.ok || data.success === false) {
    const message =
      data.error ||
      data.message ||
      `Request failed (${response.status})`

    const error = new Error(message)
    error.status = response.status
    error.payload = data

    throw error
  }

  return data
}
