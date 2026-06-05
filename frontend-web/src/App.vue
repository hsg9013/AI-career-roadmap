<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { useAuthStore } from 'frontend-shared';
const auth = useAuthStore();
</script>

<template>
  <div class="app">
    <header>
      <nav>
        <RouterLink to="/" class="brand">AI Career Roadmap</RouterLink>
        <span class="grow"></span>
        <template v-if="auth.isAuthenticated">
          <span class="user">{{ auth.user?.email }}</span>
          <button @click="auth.clearSession()">로그아웃</button>
        </template>
        <RouterLink v-else to="/login">로그인</RouterLink>
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<style>
:root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
body { margin: 0; }
.app { min-height: 100vh; }
header { border-bottom: 1px solid #e5e7eb; padding: 0.75rem 1.25rem; }
nav { display: flex; align-items: center; gap: 1rem; max-width: 1100px; margin: 0 auto; }
.brand { font-weight: 600; font-size: 1.05rem; text-decoration: none; color: #111; }
.grow { flex: 1; }
.user { color: #555; font-size: 0.9rem; }
button { background: #fff; border: 1px solid #d1d5db; padding: 0.35rem 0.8rem; border-radius: 4px; cursor: pointer; }
button:hover { background: #f3f4f6; }
</style>
