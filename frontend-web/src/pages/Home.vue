<script setup lang="ts">
import { computed } from 'vue';
import { i18n, useAuthStore } from 'frontend-shared';
const { t } = i18n;
const auth = useAuthStore();

// 역할별 홈 경로 + 학생 전용 메뉴 분기.
const ROLE_HOME: Record<string, string> = {
  student: '/dashboard', mentor: '/missions', enterprise: '/company',
  university: '/university', admin: '/admin',
};
const home = computed(() => ROLE_HOME[auth.user?.role ?? ''] ?? '/dashboard');
const isStudent = computed(() => auth.user?.role === 'student');
</script>

<template>
  <section class="hero">
    <h1>{{ t('app.title') }}</h1>
    <p class="tag">{{ t('app.tagline') }}</p>
    <div class="cta">
      <template v-if="auth.isAuthenticated">
        <router-link class="btn primary" :to="home">대시보드</router-link>
        <!-- 목표 직무 변경은 학생 계정에만 노출 -->
        <router-link v-if="isStudent" class="btn ghost" to="/onboarding">목표 직무 변경</router-link>
      </template>
      <template v-else>
        <router-link class="btn primary" to="/login">로그인 / 가입</router-link>
      </template>
    </div>
    <p class="env">
      web <code>:9516</code> · api <code>/api/v1</code> · prod <code>https://p16.sumzip.com</code>
    </p>
  </section>
</template>

<style scoped>
.hero { max-width: 720px; margin: 4rem auto; text-align: center; }
.tag { color: #666; margin-bottom: 1.5rem; }
.cta { display: flex; gap: 0.6rem; justify-content: center; margin: 1.5rem 0 2rem; }
.btn { padding: 0.6rem 1.1rem; border-radius: 4px; font-weight: 600; text-decoration: none; }
.btn.primary { background: #2563eb; color: #fff; }
.btn.ghost { background: #f3f4f6; color: #111827; }
.env { font-size: .9rem; color: #888; }
.env code { background: #f4f4f5; padding: 2px 6px; border-radius: 3px; }
</style>
