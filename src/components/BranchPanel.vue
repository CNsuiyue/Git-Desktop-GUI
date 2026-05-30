<template>
  <div class="panel branch-panel">
    <div class="panel-header">
      <h3>分支管理</h3>
      <div class="new-branch-row">
        <input v-model="newBranchName" class="input" placeholder="新分支名称" @keydown.enter="createBranch" />
        <button class="btn-sm btn-primary" :disabled="!newBranchName.trim()" @click="createBranch">创建分支</button>
      </div>
    </div>
    <div class="branch-list">
      <div v-for="branch in store.branches" :key="branch" :class="['branch-item', { active: branch === store.currentBranch }]">
        <div class="branch-info">
          <span class="branch-icon">&#x2387;</span>
          <span class="branch-name">{{ branch }}</span>
          <span v-if="branch === store.currentBranch" class="badge badge-current">当前</span>
        </div>
        <div class="branch-actions">
          <button v-if="branch !== store.currentBranch" class="btn-sm btn-primary" @click="switchToBranch(branch)">切换</button>
          <button v-if="branch !== store.currentBranch && branch !== 'master' && branch !== 'main'" class="btn-sm btn-danger" @click="removeBranch(branch)">删除</button>
        </div>
      </div>
    </div>

    <div class="panel-header" style="border-top:1px solid var(--border)">
      <h3>标签 (Tags)</h3>
      <div class="new-branch-row">
        <input v-model="newTagName" class="input" placeholder="标签名称 (如 v1.0)" @keydown.enter="createTag" />
        <button class="btn-sm btn-primary" :disabled="!newTagName.trim()" @click="createTag">创建标签</button>
        <button class="btn-sm btn-outline" @click="loadTags">刷新</button>
      </div>
    </div>
    <div class="branch-list">
      <div class="branch-item" v-for="tag in tags" :key="tag">
        <div class="branch-info">
          <span class="branch-icon">&#x1F3F7;</span>
          <span class="branch-name">{{ tag }}</span>
        </div>
        <button class="btn-sm btn-danger" @click="doDeleteTag(tag)">删除</button>
      </div>
      <div v-if="tags.length === 0" class="empty-state" style="padding:20px"><p>暂无标签</p></div>
    </div>

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGitStore } from '../stores/git.js'
import ConfirmDialog from './ConfirmDialog.vue'

const store = useGitStore()
const newBranchName = ref('')
const newTagName = ref('')
const tags = ref([])
const confirmDialog = ref(null)

onMounted(loadTags)

async function loadTags() {
  const r = await window.gitAPI.getTags()
  if (!r.error) tags.value = r.tags || []
}

async function createBranch() {
  if (!newBranchName.value.trim()) return
  await store.switchBranch(newBranchName.value.trim(), true)
  newBranchName.value = ''
}

async function createTag() {
  if (!newTagName.value.trim()) return
  const r = await window.gitAPI.createTag(newTagName.value.trim(), '')
  if (!r.error) { newTagName.value = ''; await loadTags() }
  else store.error = r.error
}

async function doDeleteTag(name) {
  const confirmed = await confirmDialog.value.show({
    title: '删除标签',
    description: '从仓库中删除指定标签',
    message: `确定删除标签 "${name}"？`,
    confirmText: '删除标签'
  })
  
  if (!confirmed) return
  
  await window.gitAPI.deleteTag(name)
  await loadTags()
}

async function switchToBranch(name) { await store.switchBranch(name) }

async function removeBranch(name) {
  const confirmed = await confirmDialog.value.show({
    title: '删除分支',
    description: '从仓库中删除指定分支',
    message: `确定要删除分支 "${name}" 吗？此操作不可撤销。`,
    confirmText: '删除分支'
  })
  
  if (!confirmed) return
  
  await store.deleteBranch(name)
}
</script>