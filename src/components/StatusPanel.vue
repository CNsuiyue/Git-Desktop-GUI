<template>
  <div class="panel status-panel">
    <div v-if="!hasChanges" class="empty-state">
      <div class="empty-icon">&#x2714;</div>
      <p>工作区干净，没有需要提交的更改</p>
    </div>

    <div v-else class="status-sections">
      <div class="search-bar">
        <input
          v-model="searchQuery"
          class="search-input"
          placeholder="搜索文件..."
        />
        <span class="search-count" v-if="searchQuery">
          {{ filteredStaged.length + filteredChanged.length }} / {{ totalFiles }}
        </span>
      </div>

      <div class="section" v-if="filteredStaged.length">
        <div class="section-header">
          <h3>已暂存 ({{ filteredStaged.length }})</h3>
          <button class="btn-sm btn-outline" @click="unstageAll()">全部取消暂存</button>
        </div>
        <div class="file-list">
          <div
            v-for="file in filteredStaged"
            :key="'staged-' + file.name"
            class="file-item staged"
          >
            <span class="file-type" :class="file.type">[{{ file.type }}]</span>
            <span class="file-name">{{ file.name }}</span>
            <div class="file-actions">
              <button class="btn-icon-sm" title="查看差异" @click="showDiff(file, true)">&#x1D0D;</button>
              <button class="btn-icon-sm" title="取消暂存" @click="store.unstageFiles([file.name])">&#x21B6;</button>
            </div>
          </div>
        </div>
      </div>

      <div class="section" v-if="filteredChanged.length">
        <div class="section-header">
          <h3>未暂存 ({{ filteredChanged.length }})</h3>
          <button class="btn-sm btn-primary" @click="stageAll()">暂存全部</button>
        </div>
        <div class="file-list">
          <div
            v-for="file in filteredChanged"
            :key="'unstaged-' + file.name"
            class="file-item"
          >
            <span class="file-type" :class="file.type">[{{ file.type }}]</span>
            <span class="file-name">{{ file.name }}</span>
            <div class="file-actions">
              <button class="btn-icon-sm" title="查看差异" @click="showDiff(file, false)">&#x1D0D;</button>
              <button class="btn-icon-sm" title="暂存" @click="store.stageFiles([file.name])">&#x2795;</button>
              <button class="btn-icon-sm btn-danger" title="丢弃更改" @click="confirmDiscard(file)">&#x2716;</button>
            </div>
          </div>
        </div>
      </div>

      <div class="commit-section" v-if="store.stagedFiles.length">
        <textarea
          v-model="commitMessage"
          class="commit-input"
          placeholder="输入提交信息..."
          rows="2"
          @keydown.ctrl.enter="doCommit"
        ></textarea>
        <button
          class="btn-primary btn-commit"
          :disabled="!commitMessage.trim()"
          @click="doCommit"
        >
          提交 (Ctrl+Enter)
        </button>
      </div>
    </div>

    <div class="diff-modal" v-if="diffContent !== null" @click.self="closeDiff">
      <div class="diff-content">
        <div class="diff-header">
          <span>{{ diffFile }}</span>
          <button class="btn-icon" @click="closeDiff">&#x2716;</button>
        </div>
        <div class="diff-body" v-html="highlightedDiff"></div>
      </div>
    </div>

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGitStore } from '../stores/git.js'
import ConfirmDialog from './ConfirmDialog.vue'

const store = useGitStore()
const commitMessage = ref('')
const diffContent = ref(null)
const diffFile = ref('')
const searchQuery = ref('')
const confirmDialog = ref(null)

const MAX_DIFF_LENGTH = 50000

const highlightedDiff = computed(() => {
  if (!diffContent.value) return ''
  const content = diffContent.value.length > MAX_DIFF_LENGTH 
    ? diffContent.value.substring(0, MAX_DIFF_LENGTH) + '\n... (差异内容过长，已截断)'
    : diffContent.value
  const lines = content.split('\n')
  const parts = []
  for (const line of lines) {
    const esc = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    if (line.startsWith('@@')) parts.push(`<span class="diff-hunk">${esc}</span>`)
    else if (line.startsWith('+')) parts.push(`<span class="diff-add">${esc}</span>`)
    else if (line.startsWith('-')) parts.push(`<span class="diff-del">${esc}</span>`)
    else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++'))
      parts.push(`<span class="diff-meta">${esc}</span>`)
    else parts.push(esc)
  }
  return parts.join('\n')
})

const searchLower = computed(() => searchQuery.value.toLowerCase().trim())

const filteredStaged = computed(() => {
  if (!searchLower.value) return store.stagedFiles
  return store.stagedFiles.filter(f => f.name.toLowerCase().includes(searchLower.value))
})

const filteredChanged = computed(() => {
  if (!searchLower.value) return store.changedFiles
  return store.changedFiles.filter(f => f.name.toLowerCase().includes(searchLower.value))
})

const hasChanges = computed(() =>
  filteredStaged.value.length > 0 || filteredChanged.value.length > 0
)

const totalFiles = computed(() => store.stagedFiles.length + store.changedFiles.length)

function onKeydown(e) {
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); store.stageAll() }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  diffContent.value = null
})

async function doCommit() {
  if (!commitMessage.value.trim()) return
  const result = await store.commit(commitMessage.value.trim())
  if (!result.error) commitMessage.value = ''
}

async function showDiff(file, staged) {
  diffFile.value = file.name
  const result = staged
    ? await store.getFileDiffStaged(file.name)
    : await store.getFileDiff(file.name)
  diffContent.value = result.diff || '无差异'
}

function closeDiff() {
  diffContent.value = null
  diffFile.value = ''
}

async function confirmDiscard(file) {
  const confirmed = await confirmDialog.value.show({
    title: '丢弃更改',
    description: '此操作将永久丢弃文件的所有更改',
    message: `确定要丢弃 "${file.name}" 的所有更改吗？此操作不可撤销。`,
    confirmText: '丢弃更改'
  })
  
  if (confirmed) {
    await store.discardFile(file.name)
  }
}

async function unstageAll() {
  const files = filteredStaged.value.map(f => f.name)
  await store.unstageFiles(files)
}

async function stageAll() {
  await store.stageAll()
  searchQuery.value = ''
}
</script>