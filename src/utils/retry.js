export async function withRetry(operation, options = {}) {
  const { maxRetries = 3, delay = 1000, backoff = 2, shouldRetry = () => true } = options
  
  let lastError = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation()
      
      if (result?.error && attempt < maxRetries && shouldRetry(result.error)) {
        lastError = result.error
        await sleep(delay * Math.pow(backoff, attempt))
        continue
      }
      
      return result
    } catch (error) {
      lastError = error
      
      if (attempt < maxRetries && shouldRetry(error)) {
        await sleep(delay * Math.pow(backoff, attempt))
        continue
      }
      
      throw error
    }
  }
  
  throw lastError
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function isNetworkError(error) {
  if (typeof error === 'string') {
    return error.includes('network') || 
           error.includes('timeout') || 
           error.includes('connection') ||
           error.includes('ECONNREFUSED') ||
           error.includes('ETIMEDOUT')
  }
  
  if (error?.message) {
    return isNetworkError(error.message)
  }
  
  return false
}

export function isAuthError(error) {
  if (typeof error === 'string') {
    return error.includes('auth') || 
           error.includes('permission') || 
           error.includes('unauthorized') ||
           error.includes('403') ||
           error.includes('401')
  }
  
  if (error?.message) {
    return isAuthError(error.message)
  }
  
  return false
}