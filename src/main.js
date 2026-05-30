import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'
import './api.js'

const loader = document.getElementById('loader')
if (loader) loader.style.display = 'none'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')