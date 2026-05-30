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
        一键推送远端
      </button>
      <button class="btn-icon" title="刷新" @click="store.refresh()">&#x21BB;</button>
      <button class="btn-icon" title="设置" @click="showSettings = true">&#x2699;</button>
      <button class="btn-icon" title="打开文件夹" @click="store.openRepo()">📂</button>
    </div>
    <div class="topbar-right" v-else>
      <button class="btn-icon" title="设置" @click="showSettings = true">&#x2699;</button>
    </div>
  </header>

  <div class="overlay" v-if="showDialog" @click.self="!pushing && closeDialog()">
    <div class="dialog dialog-wide">

      <!-- Step 1: commit message -->
      <template v-if="step === 1">
        <h4>输入提交信息</h4>
        <input v-model="pushMessage" class="dialog-input" placeholder="提交信息" ref="pushInputRef" @keydown.enter="onEnterStep1" />
        <div class="dialog-actions">
          <button class="btn-outline btn-sm" @click="closeDialog()">取消</button>
          <button class="btn-primary btn-sm" :disabled="!pushMessage.trim()" @click="onEnterStep1">下一步</button>
        </div>
      </template>

      <!-- Step 2: remote URL / select -->
      <template v-if="step === 2">
        <h4>{{ remoteMode === 'add' ? '添加远程仓库' : '选择远程仓库' }}</h4>
        <template v-if="remoteMode === 'select'">
          <p class="remote-hint">检测到多个远程仓库，请选择推送目标：</p>
          <div class="remote-select-list">
            <div v-for="r in remoteList" :key="r.name" class="remote-select-item" @click="selectRemote(r.name)">
              <span class="remote-name">{{ r.name }}</span>
              <span class="remote-url-select">{{ r.refs?.fetch || '' }}</span>
            </div>
          </div>
        </template>
        <template v-else>
          <p class="remote-hint">设置远程仓库名称和地址：</p>
          <div style="display:flex;gap:8px;margin-bottom:16px">
            <input v-model="remoteName" class="dialog-input" style="width:140px;margin-bottom:0" placeholder="名称 (origin)" />
            <input v-model="remoteInput" class="dialog-input" style="flex:1;margin-bottom:0" placeholder="https://github.com/user/repo.git" @keydown.enter="addRemoteAndNext" />
          </div>
          <div class="dialog-actions">
            <button class="btn-outline btn-sm" @click="closeDialog()">取消</button>
            <button class="btn-primary btn-sm" :disabled="!remoteInput.trim() || !remoteName.trim()" @click="addRemoteAndNext">下一步</button>
          </div>
        </template>
      </template>

      <!-- Step 3: auth token -->
      <template v-if="step === 3">
        <h4>{{ store.authToken ? 'Token 已就绪' : (store.hasTokenFile ? '输入 PIN 解密 Token' : '设置认证 Token 与 PIN') }}</h4>

        <template v-if="store.authToken">
          <p class="remote-hint">Token 已加载：{{ maskToken(store.authToken) }}</p>
          <div class="dialog-actions">
            <button class="btn-outline btn-sm" @click="closeDialog()">取消</button>
            <button class="btn-primary btn-sm" @click="doPush">开始推送</button>
          </div>
        </template>

        <template v-else-if="store.hasTokenFile">
          <p class="remote-hint">Token 已加密存储，输入 PIN 解密后推送：</p>
          <input v-model="pinOnly" class="dialog-input" type="password" placeholder="输入 PIN" maxlength="20" @keydown.enter="doUnlockAndPush" />
          <p class="auth-hint" v-if="pinError">{{ pinError }}</p>
          <div class="dialog-actions">
            <button class="btn-outline btn-sm" @click="closeDialog()">取消</button>
            <button class="btn-primary btn-sm" :disabled="!pinOnly || decrypting" @click="doUnlockAndPush">
              {{ decrypting ? '解密中...' : '解密并推送' }}
            </button>
          </div>
        </template>

        <template v-else>
          <p class="remote-hint">Personal Access Token（将加密存储，需设置 PIN）</p>
          <input v-model="tokenInput" class="dialog-input" type="password" placeholder="ghp_xxxxxxxxxxxx" />
          <p class="remote-hint">设置 PIN 码保护 Token（6位以上数字）：</p>
          <input v-model="pinValue" class="dialog-input" type="password" placeholder="PIN（6位以上）" maxlength="20" />
          <input v-model="pinConfirm" class="dialog-input" type="password" placeholder="确认 PIN" maxlength="20" @keydown.enter="doSetPinAndPush" />
          <p class="auth-hint" v-if="pinError">{{ pinError }}</p>
          <div class="dialog-actions">
            <button class="btn-outline btn-sm" @click="closeDialog()">取消</button>
            <button class="btn-primary btn-sm" :disabled="!tokenInput || pinValue.length < 6 || pinValue !== pinConfirm" @click="doSetPinAndPush">设置 PIN 并推送</button>
          </div>
        </template>
      </template>

      <!-- Progress -->
      <template v-if="step === 4 && pushing">
        <h4>一键推送远端</h4>
        <div class="progress-section">
          <div class="progress-steps-v">
            <div v-for="(s, i) in steps" :key="i" :class="['step-row', { active: s.active, done: s.done }]">
              <span class="step-num">{{ s.done ? '✔' : (s.active ? '●' : '○') }}</span>
              <div class="step-body">
                <span class="step-title">{{ s.title }}</span>
                <span class="step-detail">{{ s.detail }}</span>
              </div>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill-real" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <div class="progress-percent">{{ progressPercent }}%</div>
        </div>
      </template>
    </div>
  </div>

  <div class="overlay" v-if="showSettings" @click.self="showSettings = false">
    <div class="dialog dialog-settings">
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
            <span class="setting-desc">定时刷新仓库状态（需打开项目后生效）</span>
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
            <span class="setting-title">用户名 (user.name)</span>
            <span class="setting-desc">提交时显示的作者名称</span>
          </div>
          <input v-model="gitUserName" class="input" style="width:180px" @blur="saveConfig('user.name', gitUserName)" @keydown.enter="saveConfig('user.name', gitUserName)" />
        </div>

        <div class="setting-row">
          <div class="setting-text">
            <span class="setting-title">邮箱 (user.email)</span>
            <span class="setting-desc">提交时显示的作者邮箱</span>
          </div>
          <input v-model="gitUserEmail" class="input" style="width:220px" @blur="saveConfig('user.email', gitUserEmail)" @keydown.enter="saveConfig('user.email', gitUserEmail)" />
        </div>

        <div class="setting-row">
          <div class="setting-text">
            <span class="setting-title">HTTP 代理 (http.proxy)</span>
            <span class="setting-desc">例如 http://127.0.0.1:7890，用于加速 GitHub 访问</span>
          </div>
          <div style="display:flex;gap:4px">
            <input v-model="gitProxy" class="input" style="width:200px" placeholder="http://127.0.0.1:7890" @keydown.enter="saveConfig('http.proxy', gitProxy)" />
            <button class="btn-sm btn-outline" @click="gitProxy=''; saveConfig('http.proxy', '')">清除</button>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-text">
            <span class="setting-title">推送行为 (push.default)</span>
            <span class="setting-desc">simple：推送当前分支 | matching：推送所有匹配分支</span>
          </div>
          <select v-model="gitPushDefault" class="input" style="width:120px" @change="saveConfig('push.default', gitPushDefault)">
            <option value="simple">simple</option>
            <option value="matching">matching</option>
            <option value="current">current</option>
          </select>
        </div>

        <div class="setting-row">
          <div class="setting-text">
            <span class="setting-title">变基拉取 (pull.rebase)</span>
            <span class="setting-desc">拉取时使用变基代替合并，保持历史线性</span>
          </div>
          <select v-model="gitPullRebase" class="input" style="width:120px" @change="saveConfig('pull.rebase', gitPullRebase)">
            <option value="false">关闭</option>
            <option value="true">开启</option>
          </select>
        </div>

        <div class="setting-row">
          <div class="setting-text">
            <span class="setting-title">换行符处理 (core.autocrlf)</span>
            <span class="setting-desc">input：提交转LF | true：自动转换 | false：不处理</span>
          </div>
          <select v-model="gitAutoCrlf" class="input" style="width:120px" @change="saveConfig('core.autocrlf', gitAutoCrlf)">
            <option value="input">input</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>

        </div>

        <div class="settings-right">
          <div class="app-info-card">
            <div class="app-info-logo">&#x2B9E;</div>
            <h5>{{ appInfo.name }}</h5>
            <p class="app-version">v{{ appInfo.version }}</p>
            <div class="app-links">
              <a :href="appInfo.repo" @click.prevent="openLink(appInfo.repo)" class="app-link">GitHub 仓库</a>
            </div>
            <div class="app-author">
              <p>{{ appInfo.author }}</p>
            </div>
          </div>

          <div class="mit-notice-global">
            <div class="mit-notice-icon">📜</div>
            <div class="mit-notice-content">
              <h5>MIT 开源协议</h5>
              <p>本项目基于 MIT License 开源协议 请自觉遵守开源协议 请在使用时保留版权声明</p>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-actions" style="margin-top:12px">
        <button class="btn-outline btn-sm" @click="showSettings = false">关闭</button>
      </div>
    </div>
  </div>

  <div class="overlay" v-if="showSuccess" @click.self="showSuccess = false" style="background:rgba(0,0,0,0.2)">
    <div class="dialog" style="width:360px;text-align:center;padding:32px;border-radius:8px">
      <div style="font-size:48px;margin-bottom:12px">&#x2705;</div>
      <h4 style="color:#16a34a;margin-bottom:8px">推送成功</h4>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">远程仓库已更新</p>
      <button class="btn-primary btn-sm" style="width:120px" @click="showSuccess = false">确定</button>
    </div>
  </div>

  <div class="overlay" v-if="showPushError" @click.self="showPushError = false" style="background:rgba(0,0,0,0.2)">
    <div class="dialog" style="width:360px;text-align:center;padding:32px;border-radius:8px">
      <div style="font-size:48px;margin-bottom:12px">&#x274C;</div>
      <h4 style="color:#dc2626;margin-bottom:8px">推送失败</h4>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">{{ pushError || '未知错误' }}</p>
      <button class="btn-primary btn-sm" style="width:120px" @click="showPushError = false">确定</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted, reactive, onMounted } from 'vue'
import { useGitStore } from '../stores/git.js'

const store = useGitStore()
const showSettings = ref(false)
const autoRefreshVal = ref(0)
const gitUserName = ref('')
const gitUserEmail = ref('')
const gitProxy = ref('')
const gitPushDefault = ref('simple')
const gitPullRebase = ref('false')
const gitAutoCrlf = ref('input')
const appInfo = ref({ name: 'Git-Desktop-GUI', version: '1.0.0', author: '', repo: '' })
const showDialog = ref(false)
const step = ref(1)
const pushMessage = ref('')
const pushing = ref(false)
const pushError = ref('')
const pushInputRef = ref(null)
const progressPercent = ref(0)
const needsRemote = ref(false)
const remoteInput = ref('')
const remoteName = ref('origin')
const remoteMode = ref('add') // 'add' | 'select'
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
  const ok = await store.tryUnlockWithPin(pinOnly.value)
  decrypting.value = false
  if (!ok) {
    pinError.value = 'PIN 错误'
    pinOnly.value = ''
    return
  }
  pinOnly.value = ''; pinError.value = ''
  doPush()
}

const steps = reactive([
  { title: '暂存文件', detail: '(将变更加入暂存区 git add -A)', active: false, done: false },
  { title: '本地提交', detail: '(创建版本快照 git commit)', active: false, done: false },
  { title: '对象统计', detail: '(计算需要传输的文件数量)', active: false, done: false },
  { title: '对象压缩', detail: '(压缩数据以减少传输量)', active: false, done: false },
  { title: '数据上传', detail: '(将数据写入远程仓库)', active: false, done: false },
  { title: '推送完成', detail: '(远程仓库已更新)', active: false, done: false }
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
      gitProxy.value = m['http.proxy'] || ''
      gitPushDefault.value = m['push.default'] || 'simple'
      gitPullRebase.value = m['pull.rebase'] || 'false'
      gitAutoCrlf.value = m['core.autocrlf'] || 'input'
    }
  }
})

async function saveConfig(key, value) {
  await window.gitAPI.setGlobalConfig(key, value || '')
}

function onAutoRefresh() {
  store.setAutoRefresh(autoRefreshVal.value)
}

function openLink(url) {
  if (url) window.gitAPI.openUrl(url)
}

onUnmounted(() => { if (cleanup) cleanup() })

function closeDialog() {
  showDialog.value = false
  step.value = 1
  needsRemote.value = false
  pinValue.value = ''; pinConfirm.value = ''; pinError.value = ''; tokenInput.value = ''
}

function setStep(index) {
  steps.forEach((s, i) => {
    s.done = i < index
    s.active = i === index
  })
}

async function openPushFlow() {
  pushMessage.value = ''; pushError.value = ''; progressPercent.value = 0
  remoteInput.value = ''; remoteName.value = 'origin'; needsRemote.value = false
  pinValue.value = ''; pinConfirm.value = ''; pinError.value = ''; tokenInput.value = ''; pinOnly.value = ''
  step.value = 1; showDialog.value = true
  steps.forEach(s => { s.active = false; s.done = false })
  await nextTick()
  pushInputRef.value?.focus()
}

async function goCheckRemote() {
  if (!pushMessage.value.trim()) return
  needsRemote.value = false
  step.value = 2
}

async function goCheckAuth() {
  if (!remoteInput.value.trim() && needsRemote.value) return
  step.value = 3
}

async function doPush() {
  if (!pushMessage.value.trim() || pushing.value) return
  pushing.value = true; pushError.value = ''; progressPercent.value = 0
  step.value = 4
  steps.forEach(s => { s.active = false; s.done = false })

  cleanup = window.gitAPI.onPushProgress((data) => {
    if (data.error) { pushError.value = data.error; return }
    if (data.stage && stageToStep[data.stage] !== undefined) setStep(stageToStep[data.stage])
    if (typeof data.progress === 'number') progressPercent.value = Math.max(progressPercent.value, data.progress)
  })

  try {
    const remotes = await window.gitAPI.getRemotes()
    const hasOrigin = remotes.remotes && remotes.remotes.find(r => r.name === 'origin')
    if (!hasOrigin && remoteInput.value.trim()) {
      await window.gitAPI.setRemote(remoteName.value || 'origin', remoteInput.value.trim())
    }
    if (!hasOrigin && !remoteInput.value.trim()) {
      pushError.value = '未配置远程仓库 origin'; return
    }

    setStep(0); progressPercent.value = 5
    const sr = await window.gitAPI.stageAll()
    if (sr.error) { pushError.value = sr.error; return }

    setStep(1); progressPercent.value = 15
    const cr = await window.gitAPI.commit(pushMessage.value.trim())
    if (cr.error) { pushError.value = cr.error; return }

    setStep(2); progressPercent.value = 25
    const pr = await window.gitAPI.push(store.authToken || null, remoteName.value || 'origin')
    if (pr.error) {
      await window.gitAPI.reset('HEAD~1', '--soft')
      pushError.value = pr.error
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
  } finally {
    pushing.value = false
    if (cleanup) { cleanup(); cleanup = null }
  }
}
</script>