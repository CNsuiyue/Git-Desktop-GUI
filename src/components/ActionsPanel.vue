 <template>
  <div class="panel actions-panel">
    <div class="action-cards">
      <div class="action-card card-pull">
        <div class="card-header">
          <div class="card-icon">&#x2B07;</div>
          <div class="card-title-group">
            <h4>拉取更新</h4>
            <p>从远程仓库同步最新代码</p>
          </div>
        </div>
        <div class="card-body">
          <div class="pull-options">
            <label class="option-item">
              <input type="checkbox" v-model="options.pullRebase" />
              <span class="option-label">使用变基 (--rebase)</span>
            </label>
          </div>
        </div>
        <button class="btn-primary btn-card" @click="doPull" :disabled="loadingStates.pulling">
          {{ loadingStates.pulling ? '拉取中...' : '拉取更新' }}
        </button>
      </div>

      <div class="action-card card-push">
        <div class="card-header">
          <div class="card-icon">&#x2B06;</div>
          <div class="card-title-group">
            <h4>推送到远程</h4>
            <p>将本地提交推送到远程仓库</p>
          </div>
        </div>
        <div class="card-body">
          <div class="push-options">
            <label class="option-item">
              <input type="checkbox" v-model="options.pushForce" />
              <span class="option-label">强制推送 (--force)</span>
            </label>
            <label class="option-item">
              <input type="checkbox" v-model="options.pushTags" />
              <span class="option-label">同时推送标签</span>
            </label>
          </div>
        </div>
        <button class="btn-primary btn-card" @click="doPush" :disabled="loadingStates.pushing">
          {{ loadingStates.pushing ? '推送中...' : '推送到远程' }}
        </button>
      </div>

      <div class="action-card card-stash">
        <div class="card-header">
          <div class="card-icon">&#x1F4E6;</div>
          <div class="card-title-group">
            <h4>暂存管理</h4>
            <p>临时保存工作区更改</p>
          </div>
        </div>
        <div class="card-body">
          <div class="stash-input-group" v-if="options.showStashInput">
            <input 
              v-model="options.stashMessage" 
              class="stash-input" 
              placeholder="暂存说明（可选）"
              @keydown.enter="doStash"
            />
          </div>
          <div class="stash-stats" v-if="stashCount > 0">
            <span class="stash-badge">{{ stashCount }} 个暂存</span>
          </div>
        </div>
        <div class="card-row">
          <button class="btn-primary btn-card" @click="toggleStashInput" :disabled="loadingStates.stashing">
            {{ options.showStashInput ? '暂存并保存' : '暂存更改' }}
          </button>
          <button class="btn-outline btn-card" @click="doStashPop" :disabled="stashCount === 0">
            恢复最新
          </button>
        </div>
      </div>

      <div class="action-card card-undo">
        <div class="card-header">
          <div class="card-icon">&#x21A9;</div>
          <div class="card-title-group">
            <h4>撤销操作</h4>
            <p>回退到之前的状态</p>
          </div>
        </div>
        <div class="card-body">
          <div class="undo-options">
            <select v-model="options.undoMode" class="undo-select">
              <option value="soft">软撤销 (--soft)</option>
              <option value="mixed">混合撤销 (--mixed)</option>
              <option value="hard">硬撤销 (--hard)</option>
            </select>
            <p class="undo-hint">{{ undoHint }}</p>
          </div>
        </div>
        <button class="btn-danger btn-card" @click="undoLastCommit(confirmDialog)" :disabled="loadingStates.undoing">
          {{ loadingStates.undoing ? '撤销中...' : '撤销最近提交' }}
        </button>
      </div>

      <div class="action-card card-clean">
        <div class="card-header">
          <div class="card-icon">&#x1F9F9;</div>
          <div class="card-title-group">
            <h4>清理工作区</h4>
            <p>丢弃未跟踪的文件</p>
          </div>
        </div>
        <div class="card-body">
          <div class="clean-warning">
            <span class="warning-icon">&#x26A0;</span>
            <p class="warning-text">此操作不可逆，将永久删除未跟踪文件</p>
          </div>
        </div>
        <button class="btn-danger btn-card" @click="doClean(confirmDialog)" :disabled="loadingStates.cleaning">
          {{ loadingStates.cleaning ? '清理中...' : '清理未跟踪文件' }}
        </button>
      </div>

      <div class="action-card card-info">
        <div class="card-header">
          <div class="card-icon">&#x2699;</div>
          <div class="card-title-group">
            <h4>仓库信息</h4>
            <p>当前仓库状态概览</p>
          </div>
        </div>
        <div class="card-body">
          <div class="info-rows">
            <div class="info-row">
              <span class="info-label">路径</span>
              <span class="info-value info-path">{{ store.repoPath }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">当前分支</span>
              <span class="info-value info-branch">{{ store.currentBranch }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">状态</span>
              <span class="info-value" :class="{ clean: store.cleanState, dirty: !store.cleanState }">
                {{ store.cleanState ? '干净' : '有未提交更改' }}
              </span>
            </div>
            <div class="info-row" v-if="remoteInfo">
              <span class="info-label">远程仓库</span>
              <span class="info-value info-remote">{{ remoteInfo }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { useGitActions } from '../composables/useGitActions.js'

const confirmDialog = ref(null)

const {
  store,
  loadingStates,
  options,
  stashCount,
  undoHint,
  remoteInfo,
  doPull,
  doPush,
  doStash,
  doStashPop,
  toggleStashInput,
  undoLastCommit,
  doClean
} = useGitActions()
</script>
