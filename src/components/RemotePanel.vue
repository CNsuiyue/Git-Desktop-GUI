<template>
  <div class="panel remote-panel">
    <div class="panel-header">
      <h3>远程仓库</h3>
      <button class="btn-sm btn-outline" @click="loadRemotes">刷新</button>
    </div>

    <div class="remote-section">
      <h4>仓库地址</h4>
      <div class="remote-list" v-if="remotes.length">
        <div class="remote-item" v-for="r in remotes" :key="r.name">
          <div class="remote-info">
            <span class="remote-name">{{ r.name }}</span>
            <span class="remote-url">{{ r.refs?.fetch || '' }}</span>
          </div>
          <button class="btn-icon-sm btn-danger" title="删除" @click="doRemoveRemote(r.name)">&#x2716;</button>
        </div>
      </div>
      <div class="remote-empty" v-else>暂无远程仓库</div>
      <div class="remote-add-row" v-if="remotes.length === 0">
        <input v-model="remoteName" class="input" placeholder="名称 (origin)" style="width:140px" />
        <input v-model="remoteUrl" class="input" placeholder="https://github.com/user/repo.git" style="flex:1" @keydown.enter="doSetRemote" />
        <button class="btn-primary btn-sm" :disabled="!remoteName.trim() || !remoteUrl.trim()" @click="doSetRemote">确认</button>
      </div>
      <p class="remote-tip">格式：<code>https://github.com/user/repo.git</code></p>
    </div>

    <div class="remote-section">
      <h4>认证密钥</h4>
      <p class="remote-tip">Personal Access Token · PBKDF2 + AES-256-CBC 加密 · PIN 保护</p>

      <div v-if="store.authToken" class="token-status">
        <span class="token-masked">{{ maskToken(store.authToken) }}</span>
        <button class="btn-sm btn-danger" @click="clearToken">清除</button>
      </div>

      <div v-else-if="store.hasTokenFile" class="token-locked">
        <span class="token-masked">Token 已加密存储，请输入 PIN 解密</span>
        <div class="pin-unlock-row">
          <input v-model="remotePin" class="input" type="password" placeholder="输入 PIN" maxlength="20" @keydown.enter="doUnlockRemote" />
          <button class="btn-primary btn-sm" :disabled="!remotePin || remoteDecrypting" @click="doUnlockRemote">{{ remoteDecrypting ? '解密中...' : '解密' }}</button>
        </div>
        <p class="auth-hint" v-if="remotePinError">{{ remotePinError }}</p>
      </div>

      <div v-else class="token-empty">未设置 Token</div>

      <div class="remote-add-row" v-if="!store.authToken && !store.hasTokenFile">
        <input v-model="tokenInput" type="password" class="input" style="flex:1" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" @blur="onTokenBlur" @keydown.enter="onSetToken" />
        <button class="btn-primary btn-sm" :disabled="!tokenInput.trim()" @click="onSetToken">设置 Token</button>
      </div>

      <div v-if="store.authToken" class="pin-status">
        <span class="pin-label">PIN 已保护</span>
        <button class="btn-sm btn-outline" @click="showChangePin = true">修改 PIN</button>
      </div>

      <p class="remote-tip">GitHub → Settings → Developer settings → Personal access tokens</p>
    </div>

    <!-- PIN Setup Dialog (new token) -->
    <div class="overlay" v-if="showPinSetup" @click.self="showPinSetup = false">
      <div class="dialog">
        <h4>设置访问 PIN</h4>
        <p class="confirm-msg">请设置一个 PIN 码来保护 Token，下次访问时需要输入此 PIN 解密。</p>
        <input v-model="pinValue" class="dialog-input" type="password" placeholder="6 位以上数字" maxlength="20" @keydown.enter="doSaveToken" />
        <input v-model="pinConfirm" class="dialog-input" type="password" placeholder="确认 PIN" maxlength="20" @keydown.enter="doSaveToken" />
        <p class="auth-hint" v-if="pinError">{{ pinError }}</p>
        <div class="dialog-actions">
          <button class="btn-outline btn-sm" @click="showPinSetup = false">取消</button>
          <button class="btn-primary btn-sm" :disabled="pinValue.length < 6 || pinValue !== pinConfirm" @click="doSaveToken">确认设置</button>
        </div>
      </div>
    </div>

    <!-- Change PIN Dialog -->
    <div class="overlay" v-if="showChangePin" @click.self="showChangePin = false">
      <div class="dialog">
        <h4>修改 PIN</h4>
        <input v-model="oldPin" class="dialog-input" type="password" placeholder="当前 PIN" maxlength="20" />
        <input v-model="newPin" class="dialog-input" type="password" placeholder="新 PIN（6 位以上）" maxlength="20" />
        <input v-model="newPinConfirm" class="dialog-input" type="password" placeholder="确认新 PIN" maxlength="20" @keydown.enter="doChangePin" />
        <p class="auth-hint" v-if="pinError2">{{ pinError2 }}</p>
        <div class="dialog-actions">
          <button class="btn-outline btn-sm" @click="showChangePin = false">取消</button>
          <button class="btn-primary btn-sm" :disabled="!oldPin || newPin.length < 6 || newPin !== newPinConfirm" @click="doChangePin">确认修改</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGitStore } from '../stores/git.js'

const store = useGitStore()
const remotes = ref([])
const remoteName = ref('origin')
const remoteUrl = ref('')
const tokenInput = ref('')
const showPinSetup = ref(false)
const pinValue = ref('')
const pinConfirm = ref('')
const pinError = ref('')
const remotePin = ref('')
const remotePinError = ref('')
const remoteDecrypting = ref(false)
const showChangePin = ref(false)
const oldPin = ref('')
const newPin = ref('')
const newPinConfirm = ref('')
const pinError2 = ref('')

onMounted(() => { loadRemotes() })

async function loadRemotes() {
  const result = await store.getRemotes()
  if (result.remotes) remotes.value = result.remotes
}

function maskToken(token) {
  if (!token) return ''
  if (token.length <= 12) return '******'
  return token.slice(0, 6) + '******' + token.slice(-6)
}

function onTokenBlur() {
  if (tokenInput.value.trim()) onSetToken()
}

function onSetToken() {
  if (!tokenInput.value.trim()) return
  pinValue.value = ''
  pinConfirm.value = ''
  pinError.value = ''
  showPinSetup.value = true
}

async function doSaveToken() {
  if (pinValue.value.length < 6 || pinValue.value !== pinConfirm.value) {
    pinError.value = '两次 PIN 不一致或长度不足 6 位'
    return
  }
  const result = await store.saveTokenWithPin(tokenInput.value.trim(), pinValue.value)
  if (result.error) {
    pinError.value = result.error
    return
  }
  tokenInput.value = ''
  showPinSetup.value = false
}

async function clearToken() {
  if (!confirm('确定清除 Token 和 PIN？将删除加密文件。')) return
  await store.clearAuthToken()
}

async function doUnlockRemote() {
  if (!remotePin.value || remoteDecrypting.value) return
  remoteDecrypting.value = true; remotePinError.value = ''
  const ok = await store.tryUnlockWithPin(remotePin.value)
  remoteDecrypting.value = false
  if (!ok) { remotePinError.value = 'PIN 错误'; remotePin.value = '' }
  else { remotePin.value = ''; remotePinError.value = '' }
}

async function doChangePin() {
  if (!oldPin.value || newPin.value.length < 6 || newPin.value !== newPinConfirm.value) {
    pinError2.value = 'PIN 不一致或长度不足 6 位'
    return
  }
  const result = await window.gitAPI.changePin(oldPin.value, newPin.value)
  if (result.error) {
    pinError2.value = result.error
    return
  }
  oldPin.value = ''; newPin.value = ''; newPinConfirm.value = ''; pinError2.value = ''
  showChangePin.value = false
}

async function doSetRemote() {
  if (!remoteName.value.trim() || !remoteUrl.value.trim()) return
  let url = remoteUrl.value.trim()
  if (/https?:\/\/[^@]+@/.test(url)) {
    alert('请勿在 URL 中包含 Token，请在下方"认证密钥"中单独填写')
    url = url.replace(/^((https?:\/\/))[^@]+@/, '$1')
  }
  const result = await store.setRemote(remoteName.value.trim(), url)
  if (result.success) {
    remoteUrl.value = ''
    await loadRemotes()
  }
}

async function doRemoveRemote(name) {
  if (!confirm(`确定删除远程仓库 "${name}"？`)) return
  await store.removeRemote(name)
  await loadRemotes()
}
</script>