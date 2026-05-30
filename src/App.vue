<template>
  <div class="app-wrapper" :class="{ dark: store.darkMode }">
    <TopBar />
    <div class="main-content" v-if="store.hasRepo">
      <div class="tab-nav">
        <button v-for="tab in tabs" :key="tab.key" :class="['tab-btn', { active: store.activeTab === tab.key }]" @click="store.activeTab = tab.key">
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>
      <div class="tab-content">
        <div v-if="store.repoJustInitialized" class="remote-banner">
          <div class="remote-banner-inner">
            <span class="remote-icon">🔗</span>
            <span>仓库已初始化，连接远程仓库：</span>
            <input v-model="remoteUrl" class="remote-input" placeholder="https://github.com/user/repo.git" @keydown.enter="connectRemote" />
            <button class="btn-sm btn-primary" @click="connectRemote" :disabled="!remoteUrl.trim()">连接</button>
            <button class="btn-sm btn-outline" @click="store.repoJustInitialized = false">跳过</button>
          </div>
        </div>
        <KeepAlive>
          <component :is="currentTab" />
        </KeepAlive>
      </div>
    </div>
    <div class="welcome" v-else>
      <div class="welcome-left">
        <div class="welcome-card">
          <div class="welcome-icon">&#x2B9E;</div>
          <h2>Git-Desktop-GUI</h2>
          <p>欢迎使用 Git 图形界面客户端</p>
          <button class="btn-primary btn-lg" @click="store.openRepo()">打开文件夹</button>
        </div>
      </div>
      <div class="welcome-right" v-if="store.recentProjects.length">
        <div class="recent-panel">
          <h4 class="recent-panel-title">最近项目</h4>
          <div class="recent-list">
            <div class="recent-item" v-for="p in store.recentProjects" :key="p" @click="openRecent(p)">
              <span class="recent-icon">📁</span>
              <span class="recent-path">{{ p }}</span>
              <button class="btn-icon-sm" title="移除" @click.stop="removeRecent(p)">&#x2716;</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="loading-overlay" v-if="store.loading"><div class="spinner"></div></div>
    <div class="toast" v-if="store.error" @click="store.error = ''">{{ store.error }}</div>

    <div class="overlay" v-if="store.needPin" @click.self="() => {}">
      <div class="dialog">
        <h4>&#x1F511; Token 已加密存储</h4>
        <p class="confirm-msg">请输入 PIN 解密 Token：（仅在首次打开项目时需要）</p>
        <input v-model="pinInput" class="dialog-input" type="password" placeholder="输入 PIN" @keydown.enter="doUnlock" />
        <p class="auth-hint" v-if="pinError">{{ pinError }}</p>
        <div class="dialog-actions">
          <button class="btn-outline btn-sm" @click="skipUnlock">跳过</button>
          <button class="btn-primary btn-sm" :disabled="!pinInput.trim() || appDecrypting" @click="doUnlock">{{ appDecrypting ? '解密中...' : '解密' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, defineAsyncComponent } from 'vue'
import { useGitStore } from './stores/git.js'
import TopBar from './components/TopBar.vue'

const StatusPanel = defineAsyncComponent(() => import('./components/StatusPanel.vue'))
const HistoryPanel = defineAsyncComponent(() => import('./components/HistoryPanel.vue'))
const BranchPanel = defineAsyncComponent(() => import('./components/BranchPanel.vue'))
const StashPanel = defineAsyncComponent(() => import('./components/StashPanel.vue'))
const ActionsPanel = defineAsyncComponent(() => import('./components/ActionsPanel.vue'))
const RemotePanel = defineAsyncComponent(() => import('./components/RemotePanel.vue'))
const ProjectSettingsPanel = defineAsyncComponent(() => import('./components/ProjectSettingsPanel.vue'))

const store = useGitStore()
const remoteUrl = ref('')
const pinInput = ref('')
const pinError = ref('')
const appDecrypting = ref(false)

onMounted(async () => {
  const saved = localStorage.getItem('theme')
  if (saved === 'dark') store.toggleTheme()
  store.loadRecent()
})

async function openRecent(dir) {
  await store.openPath(dir)
}

async function removeRecent(dir) {
  await window.gitAPI.removeRecentProject(dir)
  await store.loadRecent()
}

async function doUnlock() {
  if (appDecrypting.value) return
  appDecrypting.value = true; pinError.value = ''
  const result = await store.tryUnlockWithPin(pinInput.value)
  appDecrypting.value = false
  if (!result.success) { pinError.value = result.error || 'PIN 错误，请重试'; pinInput.value = '' }
}

function skipUnlock() {
  store.needPin = false
  pinInput.value = ''
  pinError.value = ''
}

async function connectRemote() {
  if (!remoteUrl.value.trim()) return
  const result = await store.setRemote('origin', remoteUrl.value.trim())
  if (result.success) { remoteUrl.value = ''; store.repoJustInitialized = false }
}

const tabs = [
  { key: 'status', label: '暂存', icon: '📋', comp: StatusPanel },
  { key: 'history', label: '历史', icon: '📜', comp: HistoryPanel },
  { key: 'branches', label: '分支', icon: '🔀', comp: BranchPanel },
  { key: 'stash', label: '暂存栈', icon: '📦', comp: StashPanel },
  { key: 'actions', label: '快捷', icon: '⚡', comp: ActionsPanel },
  { key: 'remote', label: '当前项目远程设置', icon: '🌐', comp: RemotePanel },
  { key: 'settings', label: '当前项目设置', icon: '⚙', comp: ProjectSettingsPanel }
]

const currentTab = computed(() => {
  const tab = tabs.find(t => t.key === store.activeTab)
  return tab ? tab.comp : null
})
</script>