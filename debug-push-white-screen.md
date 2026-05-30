# Debug Session: push-white-screen

**Status:** [OPEN]
**Created:** 2026-05-30
**Bug:** 点击"解密并推送"之后，页面直接白屏

## Symptoms
- 用户输入 PIN 码后点击"解密并推送"
- 页面直接变成白屏，什么都不显示

## Reproduction Steps
1. 打开项目
2. 点击推送按钮
3. 输入提交信息 → 选择远程 → 输入 PIN 码
4. 点击"解密并推送"
5. 页面白屏

## Hypotheses

### H1: Vue 渲染冲突 - 推送对话框 DOM 结构问题
推送对话框使用了 `v-if="step === 4 && pushing"` 条件渲染，如果 `pushing` 为 true 但 `step` 不是 4，整个对话框内容会消失，导致 overlay 显示空内容。

### H2: doUnlockAndPush 中 doPush() 调用引发未捕获异常
`doUnlockAndPush` 在解密成功后调用 `doPush()`，如果 `doPush()` 内部抛出异常且未被 catch，可能导致 Vue 组件崩溃。

### H3: push-overlay 样式问题导致内容不可见
CSS 样式问题导致推送对话框内容虽然存在但不可见（如 z-index、opacity、display 等问题）。

### H4: step 状态不一致导致所有 v-if 条件都不满足
`step` 值在某个时刻变成了不在 1-4 范围内的值，导致所有步骤的 `v-if` 都不成立，对话框内容为空。

## Instrumentation Plan
1. 在 `doUnlockAndPush` 入口、解密结果、doPush 调用前后添加日志
2. 在 `doPush` 入口、每个关键步骤前后添加日志
3. 在 `step` 和 `pushing` 状态变化时添加 watch 日志
