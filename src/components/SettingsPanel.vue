<template>
  <div class="panel settings-panel">
    <div class="panel-header">
      <h3>当前项目设置</h3>
    </div>

    <div class="settings-list">
      <div class="setting-group">
        <h4>仓库维护 <span class="scope-badge">项目</span></h4>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-title">快速清理缓存</span>
            <span class="setting-desc">git gc --auto，秒级完成</span>
          </div>
          <button class="btn-sm btn-outline" @click="confirmAction('gc')">快速</button>
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-title">深度压缩仓库</span>
            <span class="setting-desc">git gc --aggressive，耗时较长</span>
          </div>
          <button class="btn-sm btn-outline" @click="confirmAction('gc-deep')">深度</button>
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-title">清理未跟踪文件</span>
            <span class="setting-desc">git clean -fd，删除未被跟踪的文件</span>
          </div>
          <button class="btn-sm btn-danger" @click="confirmAction('clean')">清理</button>
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-title">查看项目配置</span>
            <span class="setting-desc">git config --local --list</span>
          </div>
          <button class="btn-sm btn-outline" @click="showLocalConfig">查看</button>
        </div>
      </div>
    </div>

    <div class="config-output" v-if="configText">
      <div class="config-header">
        <span>{{ configTitle }}</span>
        <button class="btn-icon-sm" @click="configText = ''">&#x2716;</button>
      </div>
      <pre>{{ configText }}</pre>
    </div>

    <div class="overlay" v-if="confirmDialog.show" @click.self="confirmDialog.show = false">
      <div class="dialog">
        <h4>{{ confirmDialog.title }}</h4>
        <p class="confirm-msg">{{ confirmDialog.message }}</p>
        <div class="dialog-actions">
          <button class="btn-outline btn-sm" @click="confirmDialog.show = false">取消</button>
          <button class="btn-danger btn-sm" @click="executeConfirmed">确认执行</button>
        </div>
      </div>
    </div>

    <div class="toast" v-if="msg" @click="msg = ''">{{ msg }}</div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useGitStore } from '../stores/git.js'

const store = useGitStore()
const msg = ref('')
const configText = ref('')
const configTitle = ref('')
const pendingAction = ref('')

const confirmDialog = reactive({ show: false, title: '', message: '' })

const actionMeta = {
  gc: { title: '快速清理缓存', message: '执行 git gc --auto，通常秒级完成。\n\n确定继续吗？' },
  'gc-deep': { title: '深度压缩仓库', message: '执行 git gc --aggressive --prune=now，可能耗时较长。\n\n确定继续吗？' },
  clean: { title: '清理未跟踪文件', message: '⚠ 将永久删除所有未被 Git 跟踪的文件！\n\n确定继续吗？' }
}

function confirmAction(action) {
  const meta = actionMeta[action]
  if (!meta) return
  pendingAction.value = action
  confirmDialog.title = meta.title
  confirmDialog.message = meta.message
  confirmDialog.show = true
}

async function executeConfirmed() {
  confirmDialog.show = false
  const action = pendingAction.value
  try {
    if (action === 'gc') {
      msg.value = '正在清理...'
      const r = await window.gitAPI.runGC('auto')
      msg.value = r.error || '快速清理完成'
    } else if (action === 'gc-deep') {
      msg.value = '正在深度压缩...'
      const r = await window.gitAPI.runGC('deep')
      msg.value = r.error || '深度压缩完成'
    } else if (action === 'clean') {
      msg.value = '正在清理...'
      const r = await window.gitAPI.runClean()
      msg.value = r.error || '已清理'
    }
    await store.refresh()
    setTimeout(() => { msg.value = '' }, 3000)
  } catch (e) {
    msg.value = e.message
  }
}

async function showLocalConfig() {
  configTitle.value = '当前项目配置 (git config --local)'
  const result = await window.gitAPI.getLocalConfig()
  configText.value = result.config || result.error || '无配置'
}
</script>