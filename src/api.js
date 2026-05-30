import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'

const api = window.gitAPI || {}

window.gitAPI = {
  openRepo: async () => {
    const dir = await open({ title: '选择文件夹', directory: true, multiple: false })
    if (!dir) return null
    return invoke('open_repo', { path: dir })
  },

  openPath: (path) => invoke('open_repo', { path }),

  getStatus: () => invoke('git_status'),
  stage: (files) => invoke('git_stage', { files }),
  unstage: (files) => invoke('git_unstage', { files }),
  stageAll: () => invoke('git_stage_all'),
  commit: (message) => invoke('git_commit', { message }),
  getHistory: (count) => invoke('git_history', { count }),
  getDiff: (file) => invoke('git_diff', { file }),
  getDiffStaged: (file) => invoke('git_diff_staged', { file }),
  reset: (commitHash, mode) => invoke('git_reset', { commitHash, mode }),
  revert: (commitHash) => invoke('git_revert', { commitHash }),
  getBranches: () => invoke('git_branches'),
  checkout: (branchName, createNew) => invoke('git_checkout', { name: branchName, createNew }),
  deleteBranch: (branchName) => invoke('git_delete_branch', { name: branchName }),
  pull: () => invoke('git_pull'),
  push: (token, remoteName) => invoke('git_push', { token, remoteName }),
  pushTags: () => invoke('git_push_tags'),
  stash: (message) => invoke('git_stash', { message }),
  stashPop: () => invoke('git_stash_pop'),
  stashList: () => invoke('git_stash_list'),
  stashApply: (index) => invoke('git_stash_apply', { index }),
  stashDrop: (index) => invoke('git_stash_drop', { index }),
  discard: (file) => invoke('git_discard', { file }),
  setRemote: (name, url) => invoke('git_set_remote', { name, url }),
  getRemotes: () => invoke('git_get_remotes'),
  removeRemote: (name) => invoke('git_remove_remote', { name }),
  onPushProgress: (callback) => {
    let unlisten = null
    listen('push:progress', (event) => {
      const d = event.payload
      if (d && typeof d === 'object') callback(d)
    }).then(u => { unlisten = u })
    return () => { if (unlisten) unlisten() }
  },
  runGC: (mode) => invoke('git_run_gc', { mode }),
  runClean: () => invoke('git_run_clean'),
  clearCredentials: () => Promise.resolve({ success: true, detail: '暂不支持' }),
  getGlobalConfig: () => invoke('git_get_global_config'),
  getLocalConfig: () => invoke('git_get_local_config'),
  setGlobalConfig: (key, value) => invoke('git_set_global_config', { key, value }),
  saveToken: (token, pin) => invoke('auth_save_token', { token, pin }),
  loadToken: (pin) => invoke('auth_load_token', { pin }),
  hasToken: () => invoke('auth_has_token'),
  verifyPin: (pin) => invoke('auth_verify_pin', { pin }),
  removeTokenFile: () => invoke('auth_remove_token_file'),
  changePin: (oldPin, newPin) => invoke('auth_change_pin', { oldPin, newPin }),
  getRecentProjects: () => invoke('recent_list'),
  removeRecentProject: (dir) => invoke('recent_remove', { dir }),
  getTags: () => invoke('git_tags'),
  createTag: (name, message) => invoke('git_tag_create', { name, message }),
  deleteTag: (name) => invoke('git_tag_delete', { name }),
  getAppInfo: () => invoke('app_info'),
  openUrl: (url) => invoke('open_url', { url }),
}