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
      <button class="btn-push" @click="openPushFlow" :disabled="store.cleanState">
        <span class="push-text">推送</span>
      </button>
      <button class="btn-icon" title="刷新" @click="store.refresh()">&#x21BB;</button>
      <button class="btn-icon" title="设置" @click="showSettings = true">&#x2699;</button>
      <button class="btn-icon" title="打开文件夹" @click="store.openRepo()">&#x1F4C2;</button>
    </div>
    <div class="topbar-right" v-else>
      <button class="btn-icon" title="设置" @click="showSettings = true">&#x2699;</button>
    </div>
  </header>

  <!-- Push Dialog -->
  <div class="overlay push-overlay" v-if="showDialog" @click.self="!pushing && closeDialog()">
    <div class="push-dialog">

      <!-- Step 1: Commit Message -->
      <div class="push-step" v-if="step === 1" key="step1">
        <div class="step-header">
          <div class="step-header-text">
            <h4>提交更改</h4>
            <p>输入本次提交的说明</p>
          </div>
        </div>
        <div class="step-body">
          <textarea 
            v-model="pushMessage" 
            class="commit-input" 
            placeholder="例如：修复登录页面的样式问题" 
            ref="pushInputRef" 
            rows="3"
            @keydown.ctrl.enter="onEnterStep1"
          ></textarea>
          <div class="step-hint">按 Ctrl+Enter 快速提交</div>
        </div>
        <div class="step-actions">
          <button class="btn-ghost btn-sm" @click="closeDialog()">取消</button>
          <button class="btn-primary btn-sm" :disabled="!pushMessage.trim()" @click="onEnterStep1">
            继续
            <span class="btn-arrow">&#x2192;</span>
          </button>
        </div>
      </div>

      <!-- Step 2: Remote Selection -->
      <div class="push-step" v-if="step === 2" key="step2">
        <div class="step-header">
          <div class="step-header-text">
            <h4>{{ remoteMode === 'add' ? '添加远程仓库' : '选择远程仓库' }}</h4>
            <p>{{ remoteMode === 'add' ? '设置远程仓库地址' : '选择推送目标' }}</p>
          </div>
        </div>
        <div class="step-body">
          <template v-if="remoteMode === 'select'">
            <div class="remote-list-modern">
              <div 
                v-for="r in remoteList" 
                :key="r.name" 
                class="remote-item-modern" 
                @click="selectRemote(r.name)"
              >
                <div class="remote-info">
                  <span class="remote-name">{{ r.name }}</span>
                  <span class="remote-url">{{ r.refs?.fetch || '' }}</span>
                </div>
                <div class="remote-arrow">&#x2192;</div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="remote-input-group">
              <div class="input-row">
                <label class="input-label">名称</label>
                <input v-model="remoteName" class="input-modern" placeholder="origin" />
              </div>
              <div class="input-row">
                <label class="input-label">地址</label>
                <input v-model="remoteInput" class="input-modern" placeholder="https://github.com/user/repo.git" @keydown.enter="addRemoteAndNext" />
              </div>
            </div>
          </template>
        </div>
        <div class="step-actions">
          <button class="btn-ghost btn-sm" @click="closeDialog()">取消</button>
          <button 
            v-if="remoteMode === 'add'" 
            class="btn-primary btn-sm" 
            :disabled="!remoteInput.trim() || !remoteName.trim()" 
            @click="addRemoteAndNext"
          >
            添加并继续
            <span class="btn-arrow">&#x2192;</span>
          </button>
        </div>
      </div>

      <!-- Step 3: Authentication -->
      <div class="push-step" v-if="step === 3" key="step3">
        <div class="step-header">
          <div class="step-header-text">
            <h4>{{ store.authToken ? '身份已验证' : (store.hasTokenFile ? '输入 PIN 码' : '设置 Token') }}</h4>
            <p>{{ store.authToken ? '可以开始推送' : (store.hasTokenFile ? '解密您的 Token' : '配置推送凭证') }}</p>
          </div>
        </div>
        <div class="step-body">
          <!-- Token ready -->
          <template v-if="store.authToken">
            <div class="token-ready">
              <div class="token-info">
                <span class="token-label">Token 已加载</span>
                <span class="token-masked">{{ maskToken(store.authToken) }}</span>
              </div>
            </div>
          </template>

          <!-- PIN decrypt -->
          <template v-else-if="store.hasTokenFile">
            <div class="pin-input-group">
              <input v-model="pinOnly" class="pin-input-modern" type="password" placeholder="输入 PIN 码" maxlength="20" @keydown.enter="doUnlockAndPush" />
              <p class="auth-error" v-if="pinError">{{ pinError }}</p>
            </div>
          </template>

          <!-- Token setup -->
          <template v-else>
            <div class="token-setup">
              <div class="input-row">
                <label class="input-label">Token</label>
                <input v-model="tokenInput" class="input-modern" type="password" placeholder="ghp_xxxxxxxxxxxx" />
              </div>
              <div class="input-row">
                <label class="input-label">PIN 码</label>
                <input v-model="pinValue" class="input-modern" type="password" placeholder="6位以上数字" maxlength="20" />
              </div>
              <div class="input-row">
                <label class="input-label">确认 PIN</label>
                <input v-model="pinConfirm" class="input-modern" type="password" placeholder="再次输入 PIN" maxlength="20" @keydown.enter="doSetPinAndPush" />
              </div>
              <p class="auth-error" v-if="pinError">{{ pinError }}</p>
            </div>
          </template>
        </div>
        <div class="step-actions">
          <button class="btn-ghost btn-sm" @click="closeDialog()">取消</button>
          <button 
            v-if="store.authToken" 
            class="btn-primary btn-sm" 
            @click="doPush"
          >
            开始推送
            <span class="btn-arrow">&#x2192;</span>
          </button>
          <button 
            v-else-if="store.hasTokenFile" 
            class="btn-primary btn-sm" 
            :disabled="!pinOnly || decrypting" 
            @click="doUnlockAndPush"
          >
            {{ decrypting ? '解密中...' : '解密并推送' }}
            <span class="btn-arrow">&#x2192;</span>
          </button>
          <button 
            v-else
            class="btn-primary btn-sm" 
            :disabled="!tokenInput || pinValue.length < 6 || pinValue !== pinConfirm" 
            @click="doSetPinAndPush"
          >
            设置并推送
            <span class="btn-arrow">&#x2192;</span>
          </button>
        </div>
      </div>

      <!-- Step 4: Pushing Progress -->
      <div class="push-step push-progress-step" v-if="step === 4 && pushing" key="step4">
        <div class="step-header">
          <div class="step-header-text">
            <h4>正在推送</h4>
            <p>{{ currentStageText }}</p>
          </div>
        </div>
        <div class="step-body">
          <!-- Progress Ring -->
          <div class="progress-ring-container">
            <svg class="progress-ring" width="120" height="120">
              <circle
                class="progress-ring-bg"
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke-width="8"
              />
              <circle
                class="progress-ring-circle"
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke-width="8"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="circumference - (progressPercent / 100) * circumference"
              />
            </svg>
            <div class="progress-ring-text">
              <span class="progress-percent-large">{{ progressPercent }}%</span>
            </div>
          </div>

          <!-- Steps Timeline -->
          <div class="steps-timeline">
            <div 
              v-for="(s, i) in steps" 
              :key="i" 
              class="timeline-step"
              :class="{ active: s.active, done: s.done }"
            >
              <div class="timeline-dot">
                <span v-if="s.done" class="done-check">&#x2714;</span>
                <span v-else-if="s.active" class="active-dot"></span>
                <span v-else class="pending-dot"></span>
              </div>
              <div class="timeline-content">
                <span class="timeline-title">{{ s.title }}</span>
                <span class="timeline-detail" v-if="s.detail">{{ s.detail }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Settings Dialog -->
  <Transition name="fade">
    <div class="overlay" v-if="showSettings" @click.self="showSettings = false">
      <Transition name="slide-up">
        <div class="dialog dialog-settings" v-if="showSettings">
          <h4>全局设置</h4>
          <div class="settings-layout">
            <div class="settings-left">
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">暗色模式</span>
                  <span class="setting-desc">切换深色/浅色主题</span>
                </div>
                <button class="btn-sm" :class="store.darkMode ? 'btn-primary' : 'btn-outline'" @click="store.toggleTheme()">
                  {{ store.darkMode ? '已开启' : '已关闭' }}
                </button>
              </div>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">自动刷新</span>
                  <span class="setting-desc">定时刷新仓库状态</span>
                </div>
                <select v-model.number="autoRefreshVal" class="input" style="width:120px" @change="onAutoRefresh">
                  <option :value="0">关闭</option>
                  <option :value="5">5 秒</option>
                  <option :value="10">10 秒</option>
                  <option :value="30">30 秒</option>
                </select>
              </div>
              <h4 style="margin-top:16px;font-size:13px;color:var(--text-secondary)">Git 全局配置</h4>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">用户名</span>
                  <span class="setting-desc">提交时显示的作者名称</span>
                </div>
                <input v-model="gitUserName" class="input" style="width:180px" @blur="saveConfig('user.name', gitUserName)" />
              </div>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">邮箱</span>
                  <span class="setting-desc">提交时显示的作者邮箱</span>
                </div>
                <input v-model="gitUserEmail" class="input" style="width:220px" @blur="saveConfig('user.email', gitUserEmail)" />
              </div>
            </div>
            <div class="settings-right">
              <div class="app-info-card">
                <div class="app-info-logo">&#x2B9E;</div>
                <h5>{{ appInfo.name }}</h5>
                <p class="app-version">v{{ appInfo.version }}</p>
              </div>
            </div>
          </div>
          <div class="dialog-actions" style="margin-top:12px">
            <button class="btn-outline btn-sm" @click="showSettings = false">关闭</button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>

  <!-- Success Toast -->
  <Transition name="toast">
    <div class="success-toast" v-if="showSuccess">
      <div class="success-content">
        <h5>推送成功</h5>
        <p>远程仓库已更新</p>
      </div>
    </div>
  </Transition>

  <!-- Error Toast -->
  <Transition name="toast">
    <div class="error-toast" v-if="showPushError" @click="showPushError = false">
      <div class="error-content">
        <h5>推送失败</h5>
        <p>{{ pushError || '未知错误' }}</p>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted, reactive, onMounted, computed } from 'vue'
import { useGitStore } from '../stores/git.js'

const store = useGitStore()
const showSettings = ref(false)
const autoRefreshVal = ref(0)
const gitUserName = ref('')
const gitUserEmail = ref('')
const appInfo = ref({ name: 'Git-Desktop-GUI', version: '1.0.0' })
const showDialog = ref(false)
const step = ref(1)
const pushMessage = ref('')
const pushing = ref(false)
const pushError = ref('')
const pushInputRef = ref(null)
const progressPercent = ref(0)
const remoteInput = ref('')
const remoteName = ref('origin')
const remoteMode = ref('add')
const remoteList = ref([])
const pinValue = ref('')
const pinConfirm = ref('')
const pinError = ref('')
const tokenInput = ref('')
const pinOnly = ref('')
const decrypting = ref(false)
const showSuccess = ref(false)
const showPushError = ref(false)
let cleanup = null

const circumference = 2 * Math.PI * 52

const currentStageText = computed(() => {
  const activeStep = steps.find(s => s.active)
  if (!activeStep) return '准备中...'
  return activeStep.title
})

const steps = reactive([
  { title: '暂存文件', detail: '', active: false, done: false },
  { title: '本地提交', detail: '', active: false, done: false },
  { title: '对象统计', detail: '', active: false, done: false },
  { title: '对象压缩', detail: '', active: false, done: false },
  { title: '数据上传', detail: '', active: false, done: false },
  { title: '推送完成', detail: '', active: false, done: false }
])

const stageToStep = {
  'counting-objects': 2,
  'compressing-objects': 3,
  'writing-objects': 4,
  'done': 5
}

onMounted(() => {
  autoRefreshVal.value = parseInt(localStorage.getItem('autoRefresh') || '0')
  if (autoRefreshVal.value > 0) store.setAutoRefresh(autoRefreshVal.value)
})

watch(showSettings, async (val) => {
  if (val) {
    const info = await window.gitAPI.getAppInfo()
    if (info) appInfo.value = info
    const c = await window.gitAPI.getGlobalConfig()
    if (c.config) {
      const lines = c.config.split('\n')
      const m = {}
      lines.forEach(l => { const eq = l.indexOf('='); if (eq > 0) m[l.slice(0, eq)] = l.slice(eq + 1) })
      gitUserName.value = m['user.name'] || ''
      gitUserEmail.value = m['user.email'] || ''
    }
  }
})

async function saveConfig(key, value) {
  await window.gitAPI.setGlobalConfig(key, value || '')
}

function onAutoRefresh() {
  store.setAutoRefresh(autoRefreshVal.value)
}

onUnmounted(() => { if (cleanup) cleanup() })

function closeDialog() {
  showDialog.value = false
  step.value = 1
  pushing.value = false
  pinValue.value = ''; pinConfirm.value = ''; pinError.value = ''; tokenInput.value = ''
  pinOnly.value = ''; decrypting.value = false
  pushMessage.value = ''
  remoteName.value = ''; remoteInput.value = ''
}

function setStep(index) {
  if (index < 0 || index >= steps.length) return
  steps.forEach((s, i) => {
    s.done = i < index
    s.active = i === index
  })
}

async function openPushFlow() {
  pushMessage.value = ''; pushError.value = ''; progressPercent.value = 0
  remoteInput.value = ''; remoteName.value = 'origin'
  pinValue.value = ''; pinConfirm.value = ''; pinError.value = ''; tokenInput.value = ''; pinOnly.value = ''
  step.value = 1; showDialog.value = true
  steps.forEach(s => { s.active = false; s.done = false })
  await nextTick()
  pushInputRef.value?.focus()
}

async function onEnterStep1() {
  if (!pushMessage.value.trim()) return
  const r = await window.gitAPI.getRemotes()
  const remotes = r.remotes || []
  if (remotes.length === 0) {
    remoteMode.value = 'add'
    step.value = 2
  } else if (remotes.length === 1) {
    remoteName.value = remotes[0].name
    step.value = 3
  } else {
    remoteMode.value = 'select'
    remoteList.value = remotes
    step.value = 2
  }
}

function selectRemote(name) {
  remoteName.value = name
  step.value = 3
}

async function addRemoteAndNext() {
  if (!remoteInput.value.trim() || !remoteName.value.trim()) return
  await window.gitAPI.setRemote(remoteName.value, remoteInput.value.trim())
  remoteInput.value = ''
  step.value = 3
}

function maskToken(token) {
  if (!token) return ''
  if (token.length <= 12) return '******'
  return token.slice(0, 6) + '******' + token.slice(-6)
}

async function doSetPinAndPush() {
  if (!tokenInput.value || pinValue.value.length < 6 || pinValue.value !== pinConfirm.value) {
    pinError.value = 'PIN 不一致或长度不足 6 位'
    return
  }
  const result = await store.saveTokenWithPin(tokenInput.value, pinValue.value)
  if (result.error) { pinError.value = result.error; return }
  pinValue.value = ''; pinConfirm.value = ''; pinError.value = ''; tokenInput.value = ''
  doPush()
}

async function doUnlockAndPush() {
  if (!pinOnly.value || decrypting.value) return
  decrypting.value = true; pinError.value = ''
  const result = await store.tryUnlockWithPin(pinOnly.value)
  decrypting.value = false
  if (!result.success) {
    pinError.value = result.error || 'PIN 错误'
    return
  }
  pinOnly.value = ''; pinError.value = ''
  if (pushMessage.value.trim()) {
    doPush()
  }
}

async function doPush() {
  if (!pushMessage.value.trim()) {
    pushError.value = '提交信息不能为空'
    showPushError.value = true
    return
  }
  if (pushing.value) return
  
  pushing.value = true
  pushError.value = ''
  progressPercent.value = 0
  step.value = 4
  steps.forEach(s => { s.active = false; s.done = false })

  cleanup = window.gitAPI.onPushProgress((data) => {
    try {
      if (data.error) { pushError.value = data.error; return }
      if (data.stage && stageToStep[data.stage] !== undefined) {
        setStep(stageToStep[data.stage])
        if (data.detail && typeof data.detail === 'string') {
          const stepIdx = stageToStep[data.stage]
          if (stepIdx < steps.length) {
            steps[stepIdx].detail = data.detail
          }
        }
      }
      if (typeof data.progress === 'number') progressPercent.value = Math.max(progressPercent.value, data.progress)
    } catch (e) {
      console.error('Push progress callback error:', e)
    }
  })

  try {
    const remotes = await window.gitAPI.getRemotes()
    const hasOrigin = remotes.remotes && remotes.remotes.find(r => r.name === 'origin')
    if (!hasOrigin && remoteInput.value.trim()) {
      await window.gitAPI.setRemote(remoteName.value || 'origin', remoteInput.value.trim())
    }
    if (!hasOrigin && !remoteInput.value.trim()) {
      pushError.value = '未配置远程仓库 origin'
      pushing.value = false
      return
    }

    setStep(1); progressPercent.value = 5
    const sr = await window.gitAPI.stageAll()
    if (sr.error) { pushError.value = sr.error; pushing.value = false; return }

    setStep(2); progressPercent.value = 15
    const cr = await window.gitAPI.commit(pushMessage.value.trim())
    if (cr.error) { pushError.value = cr.error; pushing.value = false; return }

    setStep(3); progressPercent.value = 25
    const pr = await window.gitAPI.push(store.authToken || null, remoteName.value || 'origin')
    if (pr.error) {
      await window.gitAPI.reset('HEAD~1', '--soft')
      pushError.value = pr.error
      pushing.value = false
      return
    }

    setStep(5); progressPercent.value = 100
    closeDialog()
    await new Promise(r => setTimeout(r, 200))
    showSuccess.value = true
    setTimeout(() => { showSuccess.value = false }, 2500)
    store.refresh()
  } catch (e) {
    const msg = typeof e === 'string' ? e : (e?.message || String(e || '推送失败'))
    pushError.value = msg
    showPushError.value = true
    pushing.value = false
    step.value = 1
    showDialog.value = false
  } finally {
    if (cleanup) { cleanup(); cleanup = null }
  }
}
</script>
