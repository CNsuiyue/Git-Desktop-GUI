<template>
  <div class="panel">
    <div class="panel-header">
      <h3>暂存栈 (Stash)</h3>
      <div class="header-actions">
        <button class="btn-sm btn-primary" @click="doStash" :disabled="store.cleanState">暂存当前更改</button>
        <button class="btn-sm btn-outline" @click="loadStashes">刷新</button>
      </div>
    </div>
    <div v-if="stashes.length === 0" class="empty-state"><p>暂无 Stash 记录</p></div>
    <div class="stash-list" v-else>
      <div class="stash-item" v-for="(s, i) in stashes" :key="s.hash">
        <div class="stash-info">
          <span class="stash-index">stash@&#123;{{ i }}&#125;</span>
          <span class="stash-msg">{{ s.message }}</span>
          <span class="stash-date">{{ formatDate(s.date) }}</span>
        </div>
        <div class="stash-actions">
          <button class="btn-sm btn-primary" @click="doApply(i)">恢复</button>
          <button class="btn-sm btn-danger" @click="doDrop(i)">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGitStore } from '../stores/git.js'

const store = useGitStore()
const stashes = ref([])

onMounted(loadStashes)

async function loadStashes() {
  const r = await window.gitAPI.stashList()
  if (!r.error) stashes.value = r.stashes || []
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function doStash() {
  const r = await window.gitAPI.stash()
  if (r.success) { await loadStashes(); await store.refresh() }
  else store.error = r.error
}

async function doApply(i) {
  if (!confirm(`确定恢复 stash@{${i}}？`)) return
  const r = await window.gitAPI.stashApply(i)
  if (r.success) { await loadStashes(); await store.refresh() }
  else store.error = r.error
}

async function doDrop(i) {
  if (!confirm(`确定删除 stash@{${i}}？`)) return
  const r = await window.gitAPI.stashDrop(i)
  if (r.success) { await loadStashes() }
  else store.error = r.error
}
</script>