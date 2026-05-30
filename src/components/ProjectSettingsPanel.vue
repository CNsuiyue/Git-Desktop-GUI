<template>
  <div class="panel project-settings-panel">
    <div class="panel-header">
      <h3>项目设置</h3>
      <button class="btn-sm btn-outline" @click="refresh">刷新</button>
    </div>

    <div class="settings-section">
      <h4>仓库信息</h4>
      <div class="info-rows">
        <div class="info-row">
          <span class="info-label">路径</span>
          <span class="info-value info-path">{{ store.repoPath }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">当前分支</span>
          <span class="info-value info-branch">{{ store.branch }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">状态</span>
          <span class="info-value" :class="{ clean: store.cleanState, dirty: !store.cleanState }">
            {{ store.cleanState ? '干净' : '有未提交更改' }}
          </span>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h4>远程仓库</h4>
      <div class="remote-list" v-if="remotes.length">
        <div class="remote-item" v-for="r in remotes" :key="r.name">
          <div class="remote-info">
            <span class="remote-name">{{ r.name }}</span>
            <span class="remote-url">{{ r.url }}</span>
          </div>
          <button class="btn-icon-sm btn-danger" title="删除" @click="doRemoveRemote(r.name)">&#x2716;</button>
        </div>
      </div>
      <div class="remote-empty" v-else>暂无远程仓库</div>
      <div class="remote-add-row">
        <input v-model="newRemoteName" class="input" placeholder="名称 (origin)" style="width:140px" />
        <input v-model="newRemoteUrl" class="input" placeholder="https://github.com/user/repo.git" style="flex:1" @keydown.enter="doAddRemote" />
        <button class="btn-primary btn-sm" :disabled="!newRemoteName.trim() || !newRemoteUrl.trim()" @click="doAddRemote">添加</button>
      </div>
    </div>

    <div class="settings-section">
      <h4>项目 Git 配置</h4>
      <div class="config-row">
        <label>用户名</label>
        <div class="config-input-group">
          <select v-model="userNameMode" class="config-select-mode" @change="onUserNameModeChange">
            <option value="global">使用全局</option>
            <option value="custom">自定义</option>
          </select>
          <input v-if="userNameMode === 'custom'" v-model="userName" class="input" placeholder="输入用户名" @blur="saveConfig('user.name', userName)" />
          <span v-else class="config-global-value">{{ globalUserName }}</span>
        </div>
      </div>
      <div class="config-row">
        <label>邮箱</label>
        <div class="config-input-group">
          <select v-model="userEmailMode" class="config-select-mode" @change="onUserEmailModeChange">
            <option value="global">使用全局</option>
            <option value="custom">自定义</option>
          </select>
          <input v-if="userEmailMode === 'custom'" v-model="userEmail" class="input" placeholder="输入邮箱" @blur="saveConfig('user.email', userEmail)" />
          <span v-else class="config-global-value">{{ globalUserEmail }}</span>
        </div>
      </div>
      <div class="config-row">
        <label>默认分支</label>
        <input v-model="defaultBranch" class="input" placeholder="master" @blur="saveConfig('init.defaultBranch', defaultBranch)" />
      </div>
      <div class="config-row">
        <label>提交信息模板</label>
        <input v-model="commitTemplate" class="input" placeholder="文件路径（可选）" @blur="saveConfig('commit.template', commitTemplate)" />
      </div>
      <div class="config-row">
        <label>行尾符</label>
        <select v-model="coreAutocrlf" class="input" @change="saveConfig('core.autocrlf', coreAutocrlf)">
          <option value="">默认</option>
          <option value="true">true (Windows)</option>
          <option value="input">input (Mac/Linux)</option>
          <option value="false">false</option>
        </select>
      </div>
      <div class="config-row">
        <label>文件编码</label>
        <select v-model="quotepath" class="input" @change="saveConfig('core.quotepath', quotepath)">
          <option value="false">UTF-8 (false)</option>
          <option value="true">转义 (true)</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <h4>仓库维护</h4>
      <div class="maintenance-actions">
        <button class="btn-outline btn-card" @click="doGC" :disabled="gcRunning">
          {{ gcRunning ? '优化中...' : '垃圾回收 (GC)' }}
        </button>
        <p class="maintenance-desc">优化仓库，压缩对象数据库，提升性能</p>
      </div>
      <div class="maintenance-actions">
        <button class="btn-danger btn-card" @click="doClean" :disabled="cleaning">
          {{ cleaning ? '清理中...' : '清理未跟踪文件' }}
        </button>
        <p class="maintenance-desc">删除所有未被 Git 跟踪的文件和目录</p>
      </div>
    </div>

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGitStore } from '../stores/git.js'
import ConfirmDialog from './ConfirmDialog.vue'

const store = useGitStore()
const confirmDialog = ref(null)

const remotes = ref([])
const newRemoteName = ref('')
const newRemoteUrl = ref('')
const userName = ref('')
const userEmail = ref('')
const userNameMode = ref('global')
const userEmailMode = ref('global')
const globalUserName = ref('')
const globalUserEmail = ref('')
const defaultBranch = ref('')
const commitTemplate = ref('')
const coreAutocrlf = ref('')
const quotepath = ref('false')
const gcRunning = ref(false)
const cleaning = ref(false)

onMounted(async () => {
  await loadSettings()
})

async function loadSettings() {
  if (!store.hasRepo) return
  
  const r = await window.gitAPI.getRemotes()
  remotes.value = r.remotes || []
  
  const g = await window.gitAPI.getGlobalConfig()
  if (g.config) {
    const lines = g.config.split('\n')
    const m = {}
    lines.forEach(l => { const eq = l.indexOf('='); if (eq > 0) m[l.slice(0, eq)] = l.slice(eq + 1) })
    globalUserName.value = m['user.name'] || ''
    globalUserEmail.value = m['user.email'] || ''
  }
  
  const c = await window.gitAPI.getProjectConfig()
  if (c.config) {
    const lines = c.config.split('\n')
    const m = {}
    lines.forEach(l => { const eq = l.indexOf('='); if (eq > 0) m[l.slice(0, eq)] = l.slice(eq + 1) })
    if (m['user.name']) {
      userName.value = m['user.name']
      userNameMode.value = 'custom'
    } else {
      userNameMode.value = 'global'
    }
    if (m['user.email']) {
      userEmail.value = m['user.email']
      userEmailMode.value = 'custom'
    } else {
      userEmailMode.value = 'global'
    }
    defaultBranch.value = m['init.defaultBranch'] || ''
    commitTemplate.value = m['commit.template'] || ''
    coreAutocrlf.value = m['core.autocrlf'] || ''
    quotepath.value = m['core.quotepath'] || 'false'
  }
}

function onUserNameModeChange() {
  if (userNameMode.value === 'global') {
    saveConfig('user.name', '')
  }
}

function onUserEmailModeChange() {
  if (userEmailMode.value === 'global') {
    saveConfig('user.email', '')
  }
}

async function saveConfig(key, value) {
  await window.gitAPI.setProjectConfig(key, value || '')
  await loadSettings()
}

async function doAddRemote() {
  if (!newRemoteName.value.trim() || !newRemoteUrl.value.trim()) return
  await window.gitAPI.addRemote(newRemoteName.value.trim(), newRemoteUrl.value.trim())
  newRemoteName.value = ''
  newRemoteUrl.value = ''
  await loadSettings()
}

async function doRemoveRemote(name) {
  const confirmed = await confirmDialog.value.show({
    title: '删除远程仓库',
    description: `删除远程仓库 "${name}"`,
    message: `确定要删除远程仓库 "${name}" 吗？`,
    confirmText: '删除'
  })
  
  if (!confirmed) return
  
  await window.gitAPI.removeRemote(name)
  await loadSettings()
}

async function doGC() {
  gcRunning.value = true
  try {
    await window.gitAPI.runGC('auto')
    await store.refresh()
  } finally {
    gcRunning.value = false
  }
}

async function doClean() {
  const confirmed = await confirmDialog.value.show({
    title: '清理工作区',
    description: '删除所有未跟踪的文件',
    message: '确定要清理所有未跟踪的文件吗？此操作不可逆！',
    confirmText: '清理'
  })
  
  if (!confirmed) return
  
  cleaning.value = true
  try {
    await window.gitAPI.runClean()
    await store.refresh()
  } finally {
    cleaning.value = false
  }
}

async function refresh() {
  await loadSettings()
}
</script>

<style scoped>
.project-settings-panel {
  padding: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.settings-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section h4 {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--text);
}

.info-rows {
  background: var(--bg);
  border-radius: 6px;
  padding: 10px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.info-value {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}

.info-value.clean {
  color: #22c55e;
}

.info-value.dirty {
  color: #f59e0b;
}

.info-path,
.info-branch {
  font-family: monospace;
}

.remote-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.remote-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--bg);
  border-radius: 4px;
  gap: 10px;
}

.remote-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.remote-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.remote-url {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}

.remote-empty {
  text-align: center;
  padding: 16px 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.remote-add-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.config-row:last-child {
  border-bottom: none;
}

.config-row label {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
  width: 100px;
}

.config-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.config-select-mode {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  background: var(--bg);
  cursor: pointer;
  flex-shrink: 0;
  width: 100px;
}

.config-select-mode:focus {
  border-color: var(--primary);
}

.config-global-value {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

.input {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  background: var(--bg);
  transition: border-color 0.2s ease;
  flex: 1;
}

.input:focus {
  border-color: var(--primary);
}

.maintenance-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.maintenance-actions:last-child {
  margin-bottom: 0;
}

.maintenance-desc {
  font-size: 11px;
  color: var(--text-secondary);
  margin: 0;
}
</style>
