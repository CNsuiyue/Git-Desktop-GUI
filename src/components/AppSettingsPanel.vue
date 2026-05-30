<template>
  <div class="overlay" v-if="showSettings" @click.self="showSettings = false">
    <div class="dialog dialog-app-settings">
      <div class="settings-layout">
        <div class="settings-main">
          <div class="settings-header">
            <h4>应用设置</h4>
            <button class="btn-icon-sm" @click="showSettings = false">&#x2716;</button>
          </div>

          <div class="settings-content">
            <div class="settings-section">
              <h5 class="section-title">外观</h5>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">暗色模式</span>
                  <span class="setting-desc">切换深色/浅色主题</span>
                </div>
                <button class="btn-toggle" :class="{ active: store.darkMode }" @click="store.toggleTheme()">
                  <span class="toggle-dot"></span>
                </button>
              </div>
            </div>

            <div class="settings-section">
              <h5 class="section-title">常规</h5>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">自动刷新</span>
                  <span class="setting-desc">定时刷新仓库状态</span>
                </div>
                <select v-model.number="autoRefreshVal" class="select-sm" @change="onAutoRefresh">
                  <option :value="0">关闭</option>
                  <option :value="5">5 秒</option>
                  <option :value="10">10 秒</option>
                  <option :value="30">30 秒</option>
                  <option :value="60">60 秒</option>
                </select>
              </div>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">启动行为</span>
                  <span class="setting-desc">应用启动时自动打开最近仓库</span>
                </div>
                <button class="btn-toggle" :class="{ active: autoOpenLastRepo }" @click="toggleAutoOpenLastRepo">
                  <span class="toggle-dot"></span>
                </button>
              </div>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">默认分支</span>
                  <span class="setting-desc">新建仓库时的默认分支名称</span>
                </div>
                <input v-model="defaultBranch" class="input-sm" @blur="saveGlobalConfig('init.defaultBranch', defaultBranch)" />
              </div>
            </div>

            <div class="settings-section">
              <h5 class="section-title">Git 全局配置</h5>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">用户名</span>
                  <span class="setting-desc">提交时显示的作者名称</span>
                </div>
                <input v-model="gitUserName" class="input-sm" @blur="saveGlobalConfig('user.name', gitUserName)" />
              </div>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">邮箱</span>
                  <span class="setting-desc">提交时显示的作者邮箱</span>
                </div>
                <input v-model="gitUserEmail" class="input-sm" @blur="saveGlobalConfig('user.email', gitUserEmail)" />
              </div>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">默认编辑器</span>
                  <span class="setting-desc">用于编辑提交信息的编辑器</span>
                </div>
                <select v-model="coreEditor" class="select-sm" @change="saveGlobalConfig('core.editor', coreEditor)">
                  <option value="">系统默认</option>
                  <option value="code --wait">VS Code</option>
                  <option value="vim">Vim</option>
                  <option value="nano">Nano</option>
                  <option value="notepad">记事本</option>
                </select>
              </div>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">推送默认行为</span>
                  <span class="setting-desc">git push 时的默认推送范围</span>
                </div>
                <select v-model="pushDefault" class="select-sm" @change="saveGlobalConfig('push.default', pushDefault)">
                  <option value="simple">simple (推荐)</option>
                  <option value="current">current</option>
                  <option value="upstream">upstream</option>
                  <option value="nothing">nothing</option>
                </select>
              </div>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">行尾符处理</span>
                  <span class="setting-desc">提交和检出时的行尾符转换</span>
                </div>
                <select v-model="coreAutocrlf" class="select-sm" @change="saveGlobalConfig('core.autocrlf', coreAutocrlf)">
                  <option value="">默认</option>
                  <option value="true">true (Windows)</option>
                  <option value="input">input (Mac/Linux)</option>
                  <option value="false">false</option>
                </select>
              </div>
            </div>

            <div class="settings-section">
              <h5 class="section-title">数据管理</h5>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">Token 状态</span>
                  <span class="setting-desc">{{ tokenStatus }}</span>
                </div>
                <button class="btn-sm" :class="store.authToken ? 'btn-danger' : 'btn-outline'" @click="handleTokenAction">
                  {{ store.authToken ? '清除 Token' : '设置 Token' }}
                </button>
              </div>
              <div class="setting-row">
                <div class="setting-text">
                  <span class="setting-title">最近仓库</span>
                  <span class="setting-desc">清除最近打开的仓库记录</span>
                </div>
                <button class="btn-sm btn-outline" @click="clearRecentRepos">清除</button>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-sidebar">
          <div class="about-section">
            <div class="about-logo">
              <span class="about-logo-icon">&#x2B9E;</span>
            </div>
            <h5 class="about-name">{{ appInfo.name }}</h5>
            <span class="about-version">v{{ appInfo.version }}</span>
            <div class="about-divider"></div>
            <p class="about-desc">一款轻量级 Git 桌面客户端</p>
            <p class="about-desc">基于 Tauri + Vue 3 构建</p>
            <div class="about-divider"></div>
            <a class="about-link" href="https://github.com/user/Git-Desktop-GUI" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              GitHub 仓库
            </a>
            <span class="about-license">MIT License</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { useGitStore } from '../stores/git.js'

const store = useGitStore()

const showSettings = ref(false)
const autoRefreshVal = ref(0)
const autoOpenLastRepo = ref(false)
const defaultBranch = ref('')
const gitUserName = ref('')
const gitUserEmail = ref('')
const coreEditor = ref('')
const pushDefault = ref('')
const coreAutocrlf = ref('')
const appInfo = ref({ name: 'Git-Desktop-GUI', version: '1.0.0' })

const tokenStatus = computed(() => {
  if (store.authToken) return '已保存'
  if (store.hasTokenFile) return '已加密'
  return '未设置'
})

onMounted(() => {
  autoRefreshVal.value = parseInt(localStorage.getItem('autoRefresh') || '0')
  autoOpenLastRepo.value = localStorage.getItem('autoOpenLastRepo') === 'true'
  if (autoRefreshVal.value > 0) store.setAutoRefresh(autoRefreshVal.value)
})

watch(showSettings, async (val) => {
  if (val) await loadSettings()
})

async function loadSettings() {
  const info = await window.gitAPI.getAppInfo()
  if (info) appInfo.value = info
  
  const c = await window.gitAPI.getGlobalConfig()
  if (c.config) {
    const lines = c.config.split('\n')
    const m = {}
    lines.forEach(l => { const eq = l.indexOf('='); if (eq > 0) m[l.slice(0, eq)] = l.slice(eq + 1) })
    gitUserName.value = m['user.name'] || ''
    gitUserEmail.value = m['user.email'] || ''
    defaultBranch.value = m['init.defaultBranch'] || ''
    coreEditor.value = m['core.editor'] || ''
    pushDefault.value = m['push.default'] || ''
    coreAutocrlf.value = m['core.autocrlf'] || ''
  }
}

async function saveGlobalConfig(key, value) {
  await window.gitAPI.setGlobalConfig(key, value || '')
  await loadSettings()
}

function onAutoRefresh() {
  store.setAutoRefresh(autoRefreshVal.value)
}

function toggleAutoOpenLastRepo() {
  autoOpenLastRepo.value = !autoOpenLastRepo.value
  localStorage.setItem('autoOpenLastRepo', autoOpenLastRepo.value)
}

async function handleTokenAction() {
  if (store.authToken) {
    store.clearToken()
  } else {
    store.openRepo()
  }
}

async function clearRecentRepos() {
  localStorage.removeItem('lastRepoPath')
}

defineExpose({ open: () => { showSettings.value = true } })
</script>

<style scoped>
.dialog-app-settings {
  width: 640px;
  max-width: 90vw;
  max-height: 80vh;
  height: 80vh;
  overflow: hidden;
  padding: 0;
}

.settings-layout {
  display: flex;
  height: 100%;
}

.settings-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  min-height: 0;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border);
}

.settings-header h4 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.settings-content {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 12px 0;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.setting-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.btn-toggle {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--border);
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.2s ease;
}

.btn-toggle.active {
  background: var(--primary);
}

.toggle-dot {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s ease;
}

.btn-toggle.active .toggle-dot {
  transform: translateX(20px);
}

.select-sm,
.input-sm {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  background: var(--bg);
  transition: border-color 0.2s ease;
}

.select-sm:focus,
.input-sm:focus {
  border-color: var(--primary);
}

.input-sm {
  width: 180px;
}

.settings-sidebar {
  width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  background: var(--bg);
}

.about-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
}

.about-logo {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.about-logo-icon {
  font-size: 28px;
}

.about-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.about-version {
  font-size: 12px;
  color: var(--text-secondary);
}

.about-divider {
  width: 40px;
  height: 2px;
  background: var(--border);
  margin: 8px 0;
}

.about-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.about-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--primary);
  text-decoration: none;
  padding: 4px 10px;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.about-link:hover {
  background: rgba(168, 85, 247, 0.1);
}

.about-license {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.7;
}
</style>
