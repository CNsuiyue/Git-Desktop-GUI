import { ref, computed, onMounted } from 'vue'
import { useGitStore } from '../stores/git.js'

export function useGitActions() {
  const store = useGitStore()
  
  const loadingStates = ref({
    pulling: false,
    pushing: false,
    undoing: false,
    cleaning: false,
    stashing: false
  })

  const options = ref({
    pullRebase: false,
    pushForce: false,
    pushTags: false,
    showStashInput: false,
    stashMessage: '',
    undoMode: 'soft'
  })

  const stashCount = ref(0)

  const undoHint = computed(() => {
    const hints = {
      soft: '撤销提交，更改保留在暂存区',
      mixed: '撤销提交，更改保留在工作区',
      hard: '撤销提交，丢弃所有更改'
    }
    return hints[options.value.undoMode] || ''
  })

  const remoteInfo = computed(() => {
    return store.repoPath ? 'origin' : ''
  })

  const isAnyLoading = computed(() => {
    return Object.values(loadingStates.value).some(state => state)
  })

  async function loadStashCount() {
    try {
      const result = await window.gitAPI.stashList()
      stashCount.value = (result.stashes || []).length
    } catch {
      stashCount.value = 0
    }
  }

  async function doPull() {
    if (loadingStates.value.pulling) return
    loadingStates.value.pulling = true
    
    try {
      await window.gitAPI.setGlobalConfig('pull.rebase', options.value.pullRebase ? 'true' : 'false')
      const result = await store.pull()
      if (result?.error) {
        store.error = result.error
      }
    } finally {
      loadingStates.value.pulling = false
    }
  }

  async function doPush() {
    if (loadingStates.value.pushing) return
    loadingStates.value.pushing = true
    
    try {
      const result = await store.push()
      if (result?.error) {
        store.error = result.error
        return
      }
      
      if (options.value.pushTags) {
        await window.gitAPI.pushTags()
      }
    } finally {
      loadingStates.value.pushing = false
    }
  }

  async function doStash() {
    loadingStates.value.stashing = true
    
    try {
      const result = await store.stash(options.value.stashMessage || undefined)
      options.value.showStashInput = false
      options.value.stashMessage = ''
      await loadStashCount()
      
      if (result?.error) {
        store.error = result.error
      }
    } finally {
      loadingStates.value.stashing = false
    }
  }

  async function doStashPop() {
    const result = await store.stashPop()
    await loadStashCount()
    
    if (result?.error) {
      store.error = result.error
    }
  }

  function toggleStashInput() {
    if (options.value.showStashInput) {
      doStash()
    } else {
      options.value.showStashInput = true
    }
  }

  async function undoLastCommit(confirmDialog) {
    if (loadingStates.value.undoing) return
    
    const modeText = {
      soft: '软撤销（更改保留在暂存区）',
      mixed: '混合撤销（更改保留在工作区）',
      hard: '硬撤销（丢弃所有更改，不可逆）'
    }
    
    const confirmed = await confirmDialog.show({
      title: '撤销提交',
      description: `模式：${modeText[options.value.undoMode]}`,
      message: options.value.undoMode === 'hard'
        ? '硬撤销将丢弃所有更改，此操作不可逆！确定继续吗？'
        : '撤销最近一次提交，确定继续吗？',
      confirmText: '撤销提交'
    })
    
    if (!confirmed) return
    
    loadingStates.value.undoing = true
    
    try {
      await store.resetTo('HEAD~1', `--${options.value.undoMode}`)
    } finally {
      loadingStates.value.undoing = false
    }
  }

  async function doClean(confirmDialog) {
    if (loadingStates.value.cleaning) return
    
    const confirmed = await confirmDialog.show({
      title: '清理工作区',
      description: '丢弃所有未跟踪的文件',
      message: '确定要清理所有未跟踪的文件吗？此操作不可逆，文件将被永久删除！',
      confirmText: '清理工作区'
    })
    
    if (!confirmed) return
    
    loadingStates.value.cleaning = true
    
    try {
      await window.gitAPI.runClean()
      await store.refresh()
    } finally {
      loadingStates.value.cleaning = false
    }
  }

  onMounted(() => {
    loadStashCount()
  })

  return {
    store,
    loadingStates,
    options,
    stashCount,
    undoHint,
    remoteInfo,
    isAnyLoading,
    loadStashCount,
    doPull,
    doPush,
    doStash,
    doStashPop,
    toggleStashInput,
    undoLastCommit,
    doClean
  }
}