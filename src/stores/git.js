import { defineStore } from 'pinia'
import { ref, computed, shallowRef, triggerRef } from 'vue'

const MAX_HISTORY_SIZE = 200
const MAX_RECENT_PROJECTS = 10

export const useGitStore = defineStore('git', () => {
  const repoPath = ref('')
  const branch = ref('')
  const status = ref(null)
  const history = shallowRef([])
  const branches = shallowRef([])
  const currentBranch = ref('')
  const loading = ref(false)
  const error = ref('')
  const activeTab = ref('status')
  const repoJustInitialized = ref(false)
  const authToken = ref('')
  const needPin = ref(false)
  const hasTokenFile = ref(false)
  const darkMode = ref(false)
  const recentProjects = shallowRef([])
  const autoRefresh = ref(0)
  let autoRefreshTimer = null
  let refreshDebounceTimer = null
  let isRefreshing = false

  const errorHandlers = new Set()
  let _changedFilesCache = null
  let _stagedFilesCache = null
  let _lastStatusRef = null

  function onError(handler) {
    errorHandlers.add(handler)
    return () => errorHandlers.delete(handler)
  }

  function setError(message) {
    error.value = message
    if (message) {
      errorHandlers.forEach(handler => handler(message))
    }
  }

  function clearError() {
    error.value = ''
  }

  async function initAuth() {
    const result = await window.gitAPI.hasToken()
    if (result.exists) {
      needPin.value = true
      hasTokenFile.value = true
    } else {
      hasTokenFile.value = false
    }
  }

  async function tryUnlockWithPin(pin) {
    try {
      const result = await window.gitAPI.loadToken(pin)
      if (result.token) {
        authToken.value = result.token
        needPin.value = false
        return { success: true }
      }
      return { success: false, error: 'Token 解密失败' }
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e?.message || 'PIN 错误')
      return { success: false, error: msg }
    }
  }

  async function saveTokenWithPin(token, pin) {
    const result = await window.gitAPI.saveToken(token, pin)
    if (!result.error) {
      authToken.value = token
      needPin.value = false
    }
    return result
  }

  async function safeGitOperation(operation, errorMessage) {
    try {
      const result = await operation()
      if (result?.error) {
        setError(result.error)
      }
      return result
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e?.message || errorMessage)
      setError(msg)
      return { error: msg }
    }
  }

  async function clearAuthToken() {
    authToken.value = ''
    needPin.value = false
    await window.gitAPI.removeTokenFile()
  }

  async function loadRecent() {
    window.gitAPI.getRecentProjects().then(r => {
      recentProjects.value = limitArraySize(r.projects || [], MAX_RECENT_PROJECTS)
    })
  }

  function cleanup() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer)
      autoRefreshTimer = null
    }
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer)
      refreshDebounceTimer = null
    }
    _changedFilesCache = null
    _stagedFilesCache = null
    _lastStatusRef = null
    errorHandlers.clear()
  }

  function clearRepoData() {
    status.value = null
    history.value = []
    branches.value = []
    currentBranch.value = ''
    branch.value = ''
    _changedFilesCache = null
    _stagedFilesCache = null
    _lastStatusRef = null
  }

  function toggleTheme() {
    darkMode.value = !darkMode.value
    document.documentElement.className = darkMode.value ? 'dark' : ''
    localStorage.setItem('theme', darkMode.value ? 'dark' : 'light')
  }

  function setAutoRefresh(seconds) {
    autoRefresh.value = seconds
    localStorage.setItem('autoRefresh', seconds)
    if (autoRefreshTimer) clearInterval(autoRefreshTimer)
    if (seconds > 0 && repoPath.value) {
      autoRefreshTimer = setInterval(() => refresh(), seconds * 1000)
    }
  }

  const hasRepo = computed(() => !!repoPath.value)

  function buildChangedFiles(status) {
    if (!status) return []
    const files = []
    for (const f of status.modified || []) {
      files.push({ name: f, type: 'modified', staged: false })
    }
    for (const f of status.not_added || []) {
      files.push({ name: f, type: 'new', staged: false })
    }
    for (const f of status.deleted || []) {
      files.push({ name: f, type: 'deleted', staged: false })
    }
    for (const f of status.renamed || []) {
      files.push({ name: f.renamed || f, type: 'renamed', staged: false })
    }
    return files
  }

  function buildStagedFiles(status) {
    if (!status) return []
    const files = []
    for (const f of status.staged || []) {
      files.push({ name: f, type: 'staged', staged: true })
    }
    for (const f of status.created || []) {
      files.push({ name: f, type: 'created', staged: true })
    }
    return files
  }

  const changedFiles = computed(() => {
    if (_lastStatusRef === status.value && _changedFilesCache) {
      return _changedFilesCache
    }
    _changedFilesCache = buildChangedFiles(status.value)
    _lastStatusRef = status.value
    return _changedFilesCache
  })

  const stagedFiles = computed(() => {
    if (_lastStatusRef === status.value && _stagedFilesCache) {
      return _stagedFilesCache
    }
    _stagedFilesCache = buildStagedFiles(status.value)
    return _stagedFilesCache
  })

  const cleanState = computed(() => {
    if (!status.value) return false
    return status.value.isClean === true
  })

  async function openRepo() {
    const result = await window.gitAPI.openRepo()
    if (!result) return
    if (result.error) {
      setError(result.error)
      return
    }
    repoPath.value = result.path
    repoJustInitialized.value = result.initialized
    clearError()
    await refresh(false)
    initAuth()
  }

  async function openPath(dir) {
    const result = await window.gitAPI.openPath(dir)
    if (!result) return
    if (result.error) {
      setError(result.error)
      return
    }
    repoPath.value = result.path
    repoJustInitialized.value = result.initialized
    clearError()
    await refresh(false)
    initAuth()
  }

  async function setRemote(name, url) {
    return await safeGitOperation(
      () => window.gitAPI.setRemote(name, url),
      '设置远程仓库失败'
    )
  }

  async function getRemotes() {
    return await window.gitAPI.getRemotes()
  }

  async function removeRemote(name) {
    return await safeGitOperation(
      () => window.gitAPI.removeRemote(name),
      '删除远程仓库失败'
    )
  }

  function limitArraySize(arr, maxSize) {
    if (arr.length <= maxSize) return arr
    return arr.slice(0, maxSize)
  }

  async function refresh(silent = true) {
    if (!repoPath.value) return
    if (isRefreshing) return
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer)
    }
    return new Promise((resolve) => {
      refreshDebounceTimer = setTimeout(async () => {
        isRefreshing = true
        if (!silent) loading.value = true
        clearError()
        try {
          const result = await window.gitAPI.getStatus()
          if (result.error) {
            setError(result.error)
            resolve(false)
            return
          }
          status.value = result.status
          branch.value = result.branch
          history.value = limitArraySize(result.log || [], MAX_HISTORY_SIZE)
          window.gitAPI.getBranches().then(brResult => {
            if (!brResult.error) {
              branches.value = brResult.branches
              currentBranch.value = brResult.current
            }
          }).catch(() => {})
          resolve(true)
        } catch (e) {
          setError(e.message)
          resolve(false)
        } finally {
          loading.value = false
          isRefreshing = false
        }
      }, silent ? 150 : 0)
    })
  }

  async function loadHistory(count = 50) {
    const limitedCount = Math.min(count, MAX_HISTORY_SIZE)
    const result = await window.gitAPI.getHistory(limitedCount)
    if (!result.error) {
      history.value = limitArraySize(result.log || [], MAX_HISTORY_SIZE)
    }
  }

  async function stageFiles(files) {
    const result = await window.gitAPI.stage(files)
    if (result.error) setError(result.error)
    else await refresh()
  }

  async function unstageFiles(files) {
    const result = await window.gitAPI.unstage(files)
    if (result.error) setError(result.error)
    else await refresh()
  }

  async function stageAll() {
    const result = await window.gitAPI.stageAll()
    if (result.error) setError(result.error)
    else await refresh()
  }

  async function commit(message) {
    const result = await window.gitAPI.commit(message)
    if (result.error) setError(result.error)
    else await refresh()
    return result
  }

  async function resetTo(commitHash, mode) {
    const result = await window.gitAPI.reset(commitHash, mode)
    if (result.error) setError(result.error)
    else await refresh()
    return result
  }

  async function revertCommit(commitHash) {
    const result = await window.gitAPI.revert(commitHash)
    if (result.error) setError(result.error)
    else await refresh()
    return result
  }

  async function switchBranch(name, createNew = false) {
    const result = await window.gitAPI.checkout(name, createNew)
    if (result.error) setError(result.error)
    else await refresh()
    return result
  }

  async function deleteBranch(name) {
    const result = await window.gitAPI.deleteBranch(name)
    if (result.error) setError(result.error)
    else await refresh()
  }

  async function pull() {
    const result = await window.gitAPI.pull()
    if (result.error) setError(result.error)
    else await refresh()
    return result
  }

  async function push() {
    const result = await window.gitAPI.push()
    if (result.error) setError(result.error)
    else await refresh()
    return result
  }

  async function stash(message) {
    const result = await window.gitAPI.stash(message)
    if (result.error) setError(result.error)
    else await refresh()
    return result
  }

  async function stashPop() {
    const result = await window.gitAPI.stashPop()
    if (result.error) setError(result.error)
    else await refresh()
    return result
  }

  async function discardFile(file) {
    const result = await window.gitAPI.discard(file)
    if (result.error) setError(result.error)
    else await refresh()
    return result
  }

  async function getFileDiff(file) {
    return await window.gitAPI.getDiff(file)
  }

  async function getFileDiffStaged(file) {
    return await window.gitAPI.getDiffStaged(file)
  }

  return {
    repoPath, branch, status, history, branches, currentBranch,
    loading, error, activeTab, hasRepo, changedFiles, stagedFiles, cleanState,
    repoJustInitialized, authToken, needPin, hasTokenFile, darkMode, recentProjects, autoRefresh,
    initAuth, tryUnlockWithPin, saveTokenWithPin, clearAuthToken, loadRecent, toggleTheme, setAutoRefresh,
    openRepo, openPath, setRemote, getRemotes, removeRemote, refresh, loadHistory,
    stageFiles, unstageFiles, stageAll, commit,
    resetTo, revertCommit,
    switchBranch, deleteBranch,
    pull, push, stash, stashPop, discardFile,
    getFileDiff, getFileDiffStaged,
    onError, setError, clearError, safeGitOperation,
    cleanup, clearRepoData
  }
})