import { defineStore } from 'pinia'
import { ref, computed, shallowRef, triggerRef } from 'vue'

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
    const result = await window.gitAPI.loadToken(pin)
    if (result.token) {
      authToken.value = result.token
      needPin.value = false
      return true
    }
    return false
  }

  async function saveTokenWithPin(token, pin) {
    const result = await window.gitAPI.saveToken(token, pin)
    if (!result.error) {
      authToken.value = token
      needPin.value = false
    }
    return result
  }

  async function clearAuthToken() {
    authToken.value = ''
    needPin.value = false
    await window.gitAPI.removeTokenFile()
  }

  async function loadRecent() {
    window.gitAPI.getRecentProjects().then(r => {
      recentProjects.value = r.projects || []
    })
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

  const changedFiles = computed(() => {
    if (!status.value) return []
    const files = []
    for (const f of status.value.modified || []) {
      files.push({ name: f, type: 'modified', staged: false })
    }
    for (const f of status.value.not_added || []) {
      files.push({ name: f, type: 'new', staged: false })
    }
    for (const f of status.value.deleted || []) {
      files.push({ name: f, type: 'deleted', staged: false })
    }
    for (const f of status.value.renamed || []) {
      files.push({ name: f.renamed || f, type: 'renamed', staged: false })
    }
    return files
  })

  const stagedFiles = computed(() => {
    if (!status.value) return []
    const files = []
    for (const f of status.value.staged || []) {
      files.push({ name: f, type: 'staged', staged: true })
    }
    for (const f of status.value.created || []) {
      files.push({ name: f, type: 'created', staged: true })
    }
    return files
  })

  const cleanState = computed(() => {
    if (!status.value) return false
    return status.value.isClean === true
  })

  async function openRepo() {
    const result = await window.gitAPI.openRepo()
    if (!result) return
    if (result.error) {
      error.value = result.error
      return
    }
    repoPath.value = result.path
    repoJustInitialized.value = result.initialized
    error.value = ''
    await refresh(false)
    initAuth()
  }

  async function openPath(dir) {
    const result = await window.gitAPI.openPath(dir)
    if (!result) return
    if (result.error) {
      error.value = result.error
      return
    }
    repoPath.value = result.path
    repoJustInitialized.value = result.initialized
    error.value = ''
    await refresh(false)
    initAuth()
  }

  async function setRemote(name, url) {
    const result = await window.gitAPI.setRemote(name, url)
    if (result.error) {
      error.value = result.error
      return result
    }
    return result
  }

  async function getRemotes() {
    return await window.gitAPI.getRemotes()
  }

  async function removeRemote(name) {
    const result = await window.gitAPI.removeRemote(name)
    if (result.error) {
      error.value = result.error
      return result
    }
    return result
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
        error.value = ''
        try {
          const result = await window.gitAPI.getStatus()
          if (result.error) {
            error.value = result.error
            resolve(false)
            return
          }
          status.value = result.status
          branch.value = result.branch
          history.value = result.log || []
          window.gitAPI.getBranches().then(brResult => {
            if (!brResult.error) {
              branches.value = brResult.branches
              currentBranch.value = brResult.current
            }
          }).catch(() => {})
          resolve(true)
        } catch (e) {
          error.value = e.message
          resolve(false)
        } finally {
          loading.value = false
          isRefreshing = false
        }
      }, silent ? 150 : 0)
    })
  }

  async function loadHistory(count = 50) {
    const result = await window.gitAPI.getHistory(count)
    if (!result.error) {
      history.value = result.log || []
    }
  }

  async function stageFiles(files) {
    const result = await window.gitAPI.stage(files)
    if (result.error) error.value = result.error
    else await refresh()
  }

  async function unstageFiles(files) {
    const result = await window.gitAPI.unstage(files)
    if (result.error) error.value = result.error
    else await refresh()
  }

  async function stageAll() {
    const result = await window.gitAPI.stageAll()
    if (result.error) error.value = result.error
    else await refresh()
  }

  async function commit(message) {
    const result = await window.gitAPI.commit(message)
    if (result.error) error.value = result.error
    else await refresh()
    return result
  }

  async function resetTo(commitHash, mode) {
    const result = await window.gitAPI.reset(commitHash, mode)
    if (result.error) error.value = result.error
    else await refresh()
    return result
  }

  async function revertCommit(commitHash) {
    const result = await window.gitAPI.revert(commitHash)
    if (result.error) error.value = result.error
    else await refresh()
    return result
  }

  async function switchBranch(name, createNew = false) {
    const result = await window.gitAPI.checkout(name, createNew)
    if (result.error) error.value = result.error
    else await refresh()
    return result
  }

  async function deleteBranch(name) {
    const result = await window.gitAPI.deleteBranch(name)
    if (result.error) error.value = result.error
    else await refresh()
  }

  async function pull() {
    const result = await window.gitAPI.pull()
    if (result.error) error.value = result.error
    else await refresh()
    return result
  }

  async function push() {
    const result = await window.gitAPI.push()
    if (result.error) error.value = result.error
    else await refresh()
    return result
  }

  async function stash(message) {
    const result = await window.gitAPI.stash(message)
    if (result.error) error.value = result.error
    else await refresh()
    return result
  }

  async function stashPop() {
    const result = await window.gitAPI.stashPop()
    if (result.error) error.value = result.error
    else await refresh()
    return result
  }

  async function discardFile(file) {
    const result = await window.gitAPI.discard(file)
    if (result.error) error.value = result.error
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
    getFileDiff, getFileDiffStaged
  }
})