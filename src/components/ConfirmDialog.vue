<template>
  <div class="confirm-overlay" v-if="visible" @click.self="cancel()">
    <div class="confirm-dialog">
      <div class="confirm-header">
        <h4>{{ title }}</h4>
        <p class="confirm-desc">{{ description }}</p>
      </div>
      <div class="confirm-body">
        <div class="confirm-message" v-if="message">
          {{ message }}
        </div>
        <div class="pin-section">
          <p class="pin-label">输入 PIN 码确认</p>
          <input 
            v-model="pinValue" 
            type="password" 
            class="pin-input" 
            placeholder="PIN 码" 
            @keydown.enter="confirm()"
            ref="pinInputRef"
          />
          <p class="pin-error" v-if="error">{{ error }}</p>
        </div>
      </div>
      <div class="confirm-actions">
        <button class="btn-ghost" @click="cancel()" :disabled="verifying">取消</button>
        <button class="btn-danger" @click="confirm()" :disabled="!pinValue || verifying">
          {{ verifying ? '验证中...' : confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import { useGitStore } from '../stores/git.js'

const store = useGitStore()

const visible = ref(false)
const title = ref('')
const description = ref('')
const message = ref('')
const confirmText = ref('确认')
const pinValue = ref('')
const error = ref('')
const verifying = ref(false)
const pinInputRef = ref(null)

let resolvePromise = null

watch(visible, async (val) => {
  if (val) {
    await nextTick()
    pinInputRef.value?.focus()
  }
})

function show(options = {}) {
  title.value = options.title || '确认操作'
  description.value = options.description || ''
  message.value = options.message || ''
  confirmText.value = options.confirmText || '确认'
  pinValue.value = ''
  error.value = ''
  verifying.value = false
  visible.value = true
  
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

async function confirm() {
  if (!pinValue.value || verifying.value) return
  
  verifying.value = true
  error.value = ''
  
  try {
    const result = await store.tryUnlockWithPin(pinValue.value)
    if (!result.success) {
      error.value = result.error || 'PIN 错误'
      pinValue.value = ''
      verifying.value = false
      return
    }
    
    visible.value = false
    if (resolvePromise) {
      resolvePromise(true)
      resolvePromise = null
    }
  } catch (e) {
    error.value = typeof e === 'string' ? e : (e?.message || '验证失败')
    pinValue.value = ''
    verifying.value = false
  }
}

function cancel() {
  visible.value = false
  if (resolvePromise) {
    resolvePromise(false)
    resolvePromise = null
  }
}

defineExpose({ show })
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.confirm-dialog {
  width: 420px;
  max-width: 90vw;
  background: var(--card-bg);
  border-radius: 4px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.confirm-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border);
}

.confirm-header h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 6px 0;
  color: var(--text);
}

.confirm-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.confirm-body {
  padding: 20px 24px;
}

.confirm-message {
  font-size: 14px;
  color: var(--text);
  margin-bottom: 16px;
  line-height: 1.5;
}

.pin-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pin-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.pin-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  background: var(--bg);
  text-align: center;
  letter-spacing: 0.2em;
  transition: border-color 0.2s ease;
}

.pin-input:focus {
  border-color: var(--primary);
}

.pin-error {
  font-size: 12px;
  color: #ef4444;
  margin: 0;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}
</style>
