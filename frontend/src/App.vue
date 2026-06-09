<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import GenerateSettings from './components/GenerateSettings.vue'
import { fetchVersion } from './services/backendApi'

// アプリ名は固定。バージョンは runtime/version.txt 由来の値を実行時に取得する。
const APP_NAME = 'Simple ComfyUI GUI'
const version = ref('')

// バージョンが取得できれば「アプリ名 vX.Y.Z」、取得できなければアプリ名のみを表示する。
const versionLabel = computed(() =>
  version.value ? `${APP_NAME} v${version.value}` : APP_NAME
)

onMounted(async () => {
  try {
    version.value = await fetchVersion()
  } catch {
    // 取得失敗時はバージョンを付けずアプリ名のみ表示する（UIは止めない）
    version.value = ''
  }
})
</script>

<template>
  <main class="container mx-auto p-4">
    <GenerateSettings />
    <footer class="text-center text-xs text-gray-500 py-4">
      {{ versionLabel }}
    </footer>
  </main>
</template>
