<template>
  <header class="topbar">
    <div class="topbar-left">
      <span class="logo">&#x2B9E; Git-Desktop-GUI</span>
      <span class="repo-path" v-if="store.hasRepo">
        {{ store.repoPath }}
      </span>
    </div>
    <div class="topbar-right" v-if="store.hasRepo">
      <span class="branch-badge" v-if="store.branch">
        &#x2387; {{ store.branch }}
      </span>
      <span class="status-dot" :class="{ clean: store.cleanState, dirty: !store.cleanState }"></span>
      <button class="btn-push" @click="openPushDialog" :disabled="store.cleanState">
        <span class="push-text">一键推送</span>
      </button>
      <button class="btn-icon" title="刷新" @click="store.refresh()">&#x21BB;</button>
      <button class="btn-icon" title="应用设置" @click="appSettings?.open()">&#x2699;</button>
      <button class="btn-icon" title="打开文件夹" @click="store.openRepo()">&#x1F4C2;</button>
    </div>
    <div class="topbar-right" v-else>
      <button class="btn-icon" title="应用设置" @click="appSettings?.open()">&#x2699;</button>
    </div>
  </header>

  <!-- Push Dialog -->
  <div class="overlay push-overlay" v-if="showPushDialog" @click.self="!pushing && closePushDialog()">
    <div class="push-dialog">
      
      <!-- Step Indicators -->
      <div class="push-steps" v-if="!pushing">
        <div class="push-step" :class="{ active: pushStep >= 1, done: pushStep > 1 }">
          <span class="step-number">1</span>
          <span class="step-label">提交信息</span>
        </div>
        <div class="step-connector" :class="{ done: pushStep > 1 }"></div>
        <div class="push-step" :class="{ active: pushStep >= 2, done: pushStep > 2 }">
          <span class="step-number">2</span>
          <span class="step-label">身份验证</span>
        </div>
        <div class="step-connector" :class="{ done: pushStep > 2 }"></div>
        <div class="push-step" :class="{ active: pushStep >= 3 }">
          <span class="step-number">3</span>
          <span class="step-label">推送</span>
        </div>
      </div>

      <!-- Step 1: Commit Message -->
      <div v-if="pushStep === 1 && !pushing" class="push-step-content">
        <div class="step-header">
          <h4>提交信息</h4>
          <p>填写本次更改的说明</p>
        </div>
        <div class="step-body">
          <textarea 
            v-model="pushMessage" 
            class="commit-input" 
            placeholder="例如：修复登录页面的样式问题" 
            ref="pushInputRef" 
            rows="4"
            @keydown.enter.ctrl="goToStep(2)"
          ></textarea>
          
          <div class="remote-section" v-if="remoteList.length > 0">
            <label>远程仓库</label>
            <select v-model="selectedRemote" class="remote-select">
              <option v-for="r in remoteList" :key="r.name" :value="r.name">{{ r.name }}</option>
            </select>
          </div>
        </div>
        <div class="step-actions">
          <button class="btn-ghost" @click="closePushDialog()">取消</button>
          <button 
            class="btn-primary" 
            :disabled="!pushMessage.trim()" 
            @click="goToStep(2)"
          >
            下一步
          </button>
        </div>
      </div>

      <!-- Step 2: Auth -->
      <div v-else-if="pushStep === 2 && !pushing" class="push-step-content">
        <div class="step-header">
          <h4>身份验证</h4>
          <p>验证您的推送权限</p>
        </div>
        <div class="step-body">
          <template v-if="store.authToken">
            <div class="auth-ready-box">
              <span class="auth-ready-icon">&#x2705;</span>
              <div class="auth-ready-text">
                <span class="auth-ready-title">Token 已就绪</span>
                <span class="auth-ready-desc">已加载之前保存的认证信息</span>
              </div>
            </div>
          </template>
          <template v-else-if="store.hasTokenFile">
            <div class="auth-pin-box">
              <span class="auth-pin-icon">&#x1F512;</span>
              <div class="auth-pin-content">
                <span class="auth-pin-title">Token 已加密</span>
                <input 
                  v-model="pinInput" 
                  type="password" 
                  class="pin-input" 
                  placeholder="输入 PIN 码解锁" 
                  @keydown.enter="doUnlockAndGoNext"
                  ref="pinInputRef"
                />
                <p class="auth-error" v-if="pinError">{{ pinError }}</p>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="auth-new-box">
              <span class="auth-new-icon">&#x1F511;</span>
              <div class="auth-new-content">
                <span class="auth-new-title">首次设置 Token</span>
                <input v-model="tokenInput" type="password" class="token-input" placeholder="GitHub Personal Access Token" />
                <input v-model="pinInput" type="password" class="pin-input" placeholder="设置 PIN 码（6位以上）" />
                <input v-model="pinConfirm" type="password" class="pin-input" placeholder="确认 PIN 码" @keydown.enter="doSaveTokenAndGoNext" />
                <p class="auth-error" v-if="pinError">{{ pinError }}</p>
              </div>
            </div>
          </template>
        </div>
        <div class="step-actions">
          <button class="btn-ghost" @click="pushStep = 1">上一步</button>
          <button 
            class="btn-primary" 
            :disabled="!canAuth" 
            @click="handleAuthNext"
          >
            下一步
          </button>
        </div>
      </div>

      <!-- Step 3: Pushing -->
      <div v-else-if="pushing" class="pushing-state">
        <div class="pushing-header">
          <h4>正在推送</h4>
          <p>{{ pushStatusText }}</p>
        </div>
        <div class="pushing-body">
          <div class="progress-bar">
            <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <p class="progress-text">{{ progressPercent }}%</p>
        </div>
      </div>

    </div>
  </div>

  <AppSettingsPanel ref="appSettings" />

  <!-- Success Toast -->
  <Transition name="toast-slide">
    <div class="success-toast" v-if="showSuccess">
      <div class="toast-icon success-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="success-content">
        <h5>推送成功</h5>
        <p>远程仓库已更新</p>
      </div>
    </div>
  </Transition>

  <!-- Error Dialog -->
  <div class="overlay error-overlay" v-if="showErrorDialog" @click.self="showErrorDialog = false">
    <div class="error-dialog">
      <div class="error-dialog-header">
        <div class="error-dialog-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <div class="error-dialog-title">
          <h4>推送失败</h4>
          <p>以下是详细的错误信息</p>
        </div>
        <button class="btn-icon-sm" @click="showErrorDialog = false; closePushDialog()">&#x2716;</button>
      </div>
      <div class="error-dialog-body">
        <pre class="error-message-detail">{{ errorMessage }}</pre>
      </div>
      <div class="error-dialog-footer">
        <button class="btn-sm btn-outline" @click="copyError">复制错误信息</button>
        <button class="btn-sm btn-primary" @click="showErrorDialog = false; closePushDialog()">关闭</button>
      </div>
    </div>
  </div>

  <!-- Error Toast -->
  <Transition name="toast-slide">
    <div class="error-toast" v-if="showError" @click="showError = false">
      <div class="toast-icon error-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>
      <div class="error-content">
        <h5>推送失败</h5>
        <p>{{ errorMessage }}</p>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useGitStore } from '../stores/git.js'
import AppSettingsPanel from './AppSettingsPanel.vue'

const store = useGitStore()
const appSettings = ref(null)

// Push Dialog
const showPushDialog = ref(false)
const pushStep = ref(1)
const pushMessage = ref('')
const pushing = ref(false)
const pushStatusText = ref('准备中...')
const progressPercent = ref(0)
const pushInputRef = ref(null)
const pinInputRef = ref(null)

// Remote
const remoteList = ref([])
const selectedRemote = ref('origin')

// Auth
const pinInput = ref('')
const pinConfirm = ref('')
const pinError = ref('')
const tokenInput = ref('')

// Toast
const showSuccess = ref(false)
const showError = ref(false)
const showErrorDialog = ref(false)
const errorMessage = ref('')

// Cleanup
let cleanup = null

const canAuth = computed(() => {
  if (store.authToken) return true
  if (store.hasTokenFile) return pinInput.value.length > 0
  return tokenInput.value && pinInput.value.length >= 6 && pinInput.value === pinConfirm.value
})

onMounted(() => {
  const autoRefreshVal = parseInt(localStorage.getItem('autoRefresh') || '0')
  if (autoRefreshVal > 0) store.setAutoRefresh(autoRefreshVal)
})

async function openPushDialog() {
  pushStep.value = 1
  pushMessage.value = ''
  pinInput.value = ''
  pinConfirm.value = ''
  pinError.value = ''
  tokenInput.value = ''
  progressPercent.value = 0
  pushStatusText.value = '准备中...'
  
  const r = await window.gitAPI.getRemotes()
  remoteList.value = r.remotes || []
  if (remoteList.value.length > 0) {
    selectedRemote.value = remoteList.value[0].name
  }
  
  showPushDialog.value = true
  await nextTick()
  pushInputRef.value?.focus()
}

function closePushDialog() {
  showPushDialog.value = false
  pushing.value = false
  pushStep.value = 1
  if (cleanup) {
    cleanup()
    cleanup = null
  }
}

async function goToStep(step) {
  if (step === 2 && !pushMessage.value.trim()) return
  
  pushStep.value = step
  
  if (step === 2) {
    await nextTick()
    if (store.hasTokenFile && !store.authToken) {
      pinInputRef.value?.focus()
    }
  }
}

async function handleAuthNext() {
  if (!canAuth.value) return
  
  if (!store.authToken && !store.hasTokenFile) {
    await saveTokenAndPush()
  } else if (!store.authToken) {
    await unlockAndPush()
  } else {
    await executePush()
  }
}

async function doUnlockAndGoNext() {
  if (!pinInput.value || pushing.value) return
  
  pinError.value = ''
  
  try {
    const result = await store.tryUnlockWithPin(pinInput.value)
    if (!result.success) {
      pinError.value = result.error || 'PIN 错误'
      pinInput.value = ''
      return
    }
    
    pinInput.value = ''
    await executePush()
  } catch (e) {
    const msg = typeof e === 'string' ? e : (e?.message || 'PIN 错误')
    showErrorDialogMsg(msg)
    pinInput.value = ''
  }
}

async function doSaveTokenAndGoNext() {
  if (!tokenInput.value || pinInput.value.length < 6 || pinInput.value !== pinConfirm.value) {
    pinError.value = 'PIN 不一致或长度不足 6 位'
    return
  }
  
  const result = await store.saveTokenWithPin(tokenInput.value, pinInput.value)
  if (result.error) {
    pinError.value = result.error
    return
  }
  
  pinInput.value = ''
  pinConfirm.value = ''
  tokenInput.value = ''
  await executePush()
}

async function saveTokenAndPush() {
  if (!tokenInput.value || pinInput.value.length < 6 || pinInput.value !== pinConfirm.value) {
    pinError.value = 'PIN 不一致或长度不足 6 位'
    return
  }
  
  const result = await store.saveTokenWithPin(tokenInput.value, pinInput.value)
  if (result.error) {
    pinError.value = result.error
    return
  }
  
  pinInput.value = ''
  pinConfirm.value = ''
  tokenInput.value = ''
  await executePush()
}

async function unlockAndPush() {
  if (!pinInput.value || pushing.value) return
  
  pinError.value = ''
  
  try {
    const result = await store.tryUnlockWithPin(pinInput.value)
    if (!result.success) {
      pinError.value = result.error || 'PIN 错误'
      pinInput.value = ''
      return
    }
    
    pushing.value = true
    pinInput.value = ''
    await executePush()
  } catch (e) {
    pinError.value = typeof e === 'string' ? e : (e?.message || 'PIN 错误')
    pinInput.value = ''
  }
}

async function executePush() {
  if (!pushMessage.value.trim()) {
    showErrorToast('提交信息不能为空')
    return
  }
  
  pushing.value = true
  pushStep.value = 3
  progressPercent.value = 0
  pushStatusText.value = '准备中...'
  
  cleanup = window.gitAPI.onPushProgress((data) => {
    if (data.error) {
      pushStatusText.value = data.error
      return
    }
    if (data.stage) {
      const stageTexts = {
        'counting-objects': '统计对象...',
        'compressing-objects': '压缩对象...',
        'writing-objects': '上传数据...',
        'done': '推送完成...'
      }
      pushStatusText.value = stageTexts[data.stage] || data.stage
    }
    if (typeof data.progress === 'number') {
      progressPercent.value = Math.max(progressPercent.value, data.progress)
    }
  })

  try {
    pushStatusText.value = '暂存文件...'
    progressPercent.value = 10
    const sr = await window.gitAPI.stageAll()
    if (sr.error) throw new Error(sr.error)

    pushStatusText.value = '本地提交...'
    progressPercent.value = 30
    const cr = await window.gitAPI.commit(pushMessage.value.trim())
    if (cr.error) throw new Error(cr.error)

    pushStatusText.value = '推送到远程...'
    progressPercent.value = 50
    const pr = await window.gitAPI.push(store.authToken, selectedRemote.value)
    if (pr.error) {
      try { await window.gitAPI.reset('HEAD~1', '--soft') } catch {}
      throw new Error(pr.error)
    }

    progressPercent.value = 100
    pushStatusText.value = '推送完成'
    
    setTimeout(() => {
      closePushDialog()
      showSuccessToast()
      store.refresh()
    }, 500)
  } catch (e) {
    const msg = (typeof e === 'string' && e.trim()) ? e
      : (typeof e?.message === 'string' && e.message.trim()) ? e.message
      : (typeof e === 'object' ? JSON.stringify(e) : String(e ?? '推送失败'))
    showErrorDialogMsg(msg)
  } finally {
    if (cleanup) {
      cleanup()
      cleanup = null
    }
    pushing.value = false
  }
}

function showSuccessToast() {
  showSuccess.value = true
  setTimeout(() => { showSuccess.value = false }, 3000)
}

function showErrorToast(msg) {
  errorMessage.value = msg
  showError.value = true
  setTimeout(() => { showError.value = false }, 5000)
}

function showErrorDialogMsg(msg) {
  errorMessage.value = msg || '推送失败，请检查网络连接和远程仓库权限'
  showErrorDialog.value = true
}

async function copyError() {
  try {
    await navigator.clipboard.writeText(errorMessage.value)
  } catch (e) {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = errorMessage.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}
</script>
