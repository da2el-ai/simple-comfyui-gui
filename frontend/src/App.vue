<script setup lang="ts">
import { onMounted } from 'vue'
import { useBootstrap } from './composables/useBootstrap'

const { loading, errorMessage, endpoint, workflows, bootstrap } = useBootstrap()

onMounted(() => {
  void bootstrap()
})
</script>

<template>
  <main class="container">
    <h1>simple-comfyui-gui フロントエンド</h1>
    <div class="card">
      <div class="row" style="justify-content: space-between">
        <strong>バックエンド初期データ</strong>
        <button :disabled="loading" @click="bootstrap">
          {{ loading ? '読込中...' : '再取得' }}
        </button>
      </div>

      <p v-if="errorMessage" style="color: #b91c1c">{{ errorMessage }}</p>

      <p><strong>ComfyUI Endpoint:</strong> {{ endpoint || '-' }}</p>

      <div>
        <strong>Workflows:</strong>
        <ul>
          <li v-for="name in workflows" :key="name">{{ name }}</li>
        </ul>
      </div>
    </div>
  </main>
</template>
