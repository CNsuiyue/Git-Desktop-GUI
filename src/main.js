import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'
import './api.js'

import { getCurrentWindow } from '@tauri-apps/api/window'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

const showWindow = async () => {
  try {
    await getCurrentWindow().show()
    await getCurrentWindow().setFocus()
  } catch (e) {
    console.error('Failed to show window:', e)
  }
}

if (document.readyState === 'complete') {
  setTimeout(showWindow, 100)
} else {
  window.addEventListener('load', () => setTimeout(showWindow, 100))
}