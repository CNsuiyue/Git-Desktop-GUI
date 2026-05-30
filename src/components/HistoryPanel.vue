<template>
  <div class="panel history-panel">
    <div class="panel-header">
      <h3>提交历史</h3>
      <div class="header-actions">
        <span class="history-count" v-if="store.history.length">共 {{ loadedCount }} 条</span>
        <button class="btn-sm btn-outline" @click="loadMore" v-if="hasMore">加载更多</button>
      </div>
    </div>

    <div v-if="store.history.length === 0" class="empty-state">
      <p>暂无提交记录</p>
    </div>

    <div class="history-list" v-else>
      <div
        v-for="(commit, index) in store.history"
        :key="commit.hash"
        class="history-item"
        :class="{ latest: index === 0 }"
      >
        <div class="commit-hash">{{ commit.hash.substring(0, 7) }}</div>
        <div class="commit-info">
          <div class="commit-message">{{ commit.message }}</div>
          <div class="commit-meta">
            <span>{{ commit.author_name }}</span>
            <span>{{ formatDate(commit.date) }}</span>
            <span v-if="index === 0" class="badge badge-current">HEAD</span>
          </div>
        </div>
        <div class="commit-actions">
          <button
            class="btn-sm btn-outline"
            title="软回滚（保留更改）"
            @click="handleSoftReset(commit.hash)"
          >软回滚</button>
          <button
            class="btn-sm btn-outline"
            title="混合回滚（保留工作区）"
            @click="handleMixedReset(commit.hash)"
          >混合回滚</button>
          <button
            class="btn-sm btn-danger"
            title="硬回滚（丢弃所有更改）"
            @click="handleHardReset(commit.hash)"
          >硬回滚</button>
          <button
            v-if="index !== 0"
            class="btn-sm btn-outline"
            @click="handleRevert(commit.hash)"
          >撤销</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGitStore } from '../stores/git.js'

const store = useGitStore()
const pageSize = 15
const loadedCount = ref(0)
const hasMore = ref(true)

onMounted(() => { loadMore() })

async function loadMore() {
  const target = loadedCount.value + pageSize
  await store.loadHistory(target)
  if (store.history.length < target) hasMore.value = false
  loadedCount.value = store.history.length
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function handleSoftReset(hash) {
  if (!confirm(`软回滚到 ${hash.substring(0, 7)}？\n工作区和暂存区的更改将被保留。`)) return
  await store.resetTo(hash, '--soft')
}

async function handleMixedReset(hash) {
  if (!confirm(`混合回滚到 ${hash.substring(0, 7)}？\n暂存区将被清空，工作区更改保留。`)) return
  await store.resetTo(hash, '--mixed')
}

async function handleHardReset(hash) {
  if (!confirm(`⚠ 硬回滚到 ${hash.substring(0, 7)}？\n此操作将丢弃该提交之后的所有更改，不可恢复！`)) return
  await store.resetTo(hash, '--hard')
}

async function handleRevert(hash) {
  if (!confirm(`撤销提交 ${hash.substring(0, 7)}？\n将创建一个新的反向提交。`)) return
  await store.revertCommit(hash)
}
</script>