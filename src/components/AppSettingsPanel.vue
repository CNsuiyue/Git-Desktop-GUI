<template>
  <div class="overlay" v-if="showSettings" @click.self="showSettings = false">
    <div class="dialog dialog-app-settings">
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
        </div>

        <div class="settings-section">
          <h5 class="section-title">关于</h5>
          <div class="app-info">
            <div class="app-logo">&#x2B9E;</div>
            <div class="app-details">
              <span class="app-name">{{ appInfo.name }}</span>
              <span class="app-version">v{{ appInfo.version }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useGitStore } from '../stores/git.js'

const store = useGitStore()

const showSettings = ref(false)
const autoRefreshVal = ref(0)
const gitUserName = ref('')
const gitUserEmail = ref('')
const appInfo = ref({ name: 'Git-Desktop-GUI', version: '1.0.0' })

onMounted(() => {
  autoRefreshVal.value = parseInt(localStorage.getItem('autoRefresh') || '0')
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
  }
}

async function saveGlobalConfig(key, value) {
  await window.gitAPI.setGlobalConfig(key, value || '')
  await loadSettings()
}

function onAutoRefresh() {
  store.setAutoRefresh(autoRefreshVal.value)
}

defineExpose({ open: () => { showSettings.value = true } })
</script>

<style scoped>
.dialog-app-settings {
  width: 480px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
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

.app-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg);
  border-radius: 8px;
}

.app-logo {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.app-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.app-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.app-version {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
