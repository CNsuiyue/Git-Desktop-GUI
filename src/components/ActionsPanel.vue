<template>
  <div class="panel actions-panel">
    <div class="action-cards">
      <div class="action-card">
        <div class="card-icon">&#x2B07;</div>
        <h4>拉取更新</h4>
        <p>从远程仓库拉取最新代码</p>
        <button class="btn-primary btn-card" @click="doPull">执行拉取</button>
      </div>

      <div class="action-card">
        <div class="card-icon">&#x2B06;</div>
        <h4>推送到远程</h4>
        <p>将本地提交推送到远程仓库</p>
        <button class="btn-primary btn-card" @click="doPush">执行推送</button>
      </div>

      <div class="action-card">
        <div class="card-icon">&#x1F4E6;</div>
        <h4>暂存工作区</h4>
        <p>将未提交的更改临时保存到 stash</p>
        <div class="card-row">
          <button class="btn-primary btn-card" @click="doStash">暂存 (Stash)</button>
          <button class="btn-outline btn-card" @click="doStashPop">恢复 (Pop)</button>
        </div>
      </div>

      <div class="action-card">
        <div class="card-icon">&#x21A9;</div>
        <h4>撤销最近提交</h4>
        <p>撤销最近一次提交，保留更改在工作区</p>
        <button class="btn-danger btn-card" @click="undoLastCommit">撤销提交</button>
      </div>

      <div class="action-card">
        <div class="card-icon">&#x2699;</div>
        <h4>仓库信息</h4>
        <div class="info-rows">
          <div class="info-row">
            <span class="info-label">路径</span>
            <span class="info-value">{{ store.repoPath }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">当前分支</span>
            <span class="info-value">{{ store.currentBranch }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">状态</span>
            <span class="info-value" :class="{ clean: store.cleanState, dirty: !store.cleanState }">
              {{ store.cleanState ? '干净' : '有未提交更改' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGitStore } from '../stores/git.js'

const store = useGitStore()

async function doPull() {
  if (!confirm('拉取远程仓库更新？')) return
  await store.pull()
}

async function doPush() {
  if (!confirm('推送到远程仓库？')) return
  await store.push()
}

async function doStash() {
  await store.stash()
}

async function doStashPop() {
  await store.stashPop()
}

async function undoLastCommit() {
  if (!confirm('撤销最近一次提交（--soft），更改将回到暂存区？')) return
  await store.resetTo('HEAD~1', '--soft')
}
</script>