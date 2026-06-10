<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useNotificationsStore } from 'frontend-shared';

// US4/US5 알림 센터 + 채널 설정(FR-009). in_app 은 항상 on, push/email 토글.

const store = useNotificationsStore();
const saving = ref(false);
const savedAt = ref<string | null>(null);

onMounted(async () => {
  await Promise.all([store.fetchAll(), store.fetchSettings()]);
});

async function toggle(channel: 'push' | 'email'): Promise<void> {
  saving.value = true;
  savedAt.value = null;
  try {
    await store.updateSettings({
      push: channel === 'push' ? !store.settings.push : store.settings.push,
      email: channel === 'email' ? !store.settings.email : store.settings.email,
    });
    savedAt.value = '저장됨';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="notifications">
    <header><h2>알림</h2></header>

    <div class="settings">
      <h3>알림 채널 설정</h3>
      <p class="muted">앱 내 알림은 항상 켜져 있습니다. 푸시·이메일 수신을 선택하세요.</p>
      <ul class="toggles">
        <li>
          <span>앱 내 알림</span>
          <label class="switch on disabled"><input type="checkbox" checked disabled /><span class="slider" /></label>
        </li>
        <li>
          <span>모바일 푸시</span>
          <label class="switch" :class="{ on: store.settings.push }">
            <input type="checkbox" :checked="store.settings.push" :disabled="saving" @change="toggle('push')" />
            <span class="slider" />
          </label>
        </li>
        <li>
          <span>이메일</span>
          <label class="switch" :class="{ on: store.settings.email }">
            <input type="checkbox" :checked="store.settings.email" :disabled="saving" @change="toggle('email')" />
            <span class="slider" />
          </label>
        </li>
      </ul>
      <small v-if="savedAt" class="saved">{{ savedAt }}</small>
    </div>

    <ul class="list">
      <li v-for="n in store.notifications" :key="n.id" class="noti" :class="{ unread: !n.read_at }">
        <div>
          <strong>{{ n.title }}</strong>
          <span class="type">{{ n.type }}</span>
          <span class="time">{{ n.sent_at }}</span>
        </div>
        <button v-if="!n.read_at" @click="store.markRead(n.id)">읽음</button>
      </li>
    </ul>
    <p v-if="!store.loading && store.notifications.length === 0" class="muted empty">새 알림이 없습니다.</p>
  </section>
</template>

<style scoped>
.notifications { max-width: 680px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.settings { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem 1.2rem; margin-bottom: 1.2rem; }
.settings h3 { margin: 0 0 0.3rem; font-size: 1rem; }
.toggles { list-style: none; padding: 0; margin: 0.8rem 0 0; display: grid; gap: 0.6rem; }
.toggles li { display: flex; justify-content: space-between; align-items: center; }
.switch { position: relative; display: inline-block; width: 42px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.switch .slider { position: absolute; inset: 0; background: #d1d5db; border-radius: 999px; transition: 0.2s; cursor: pointer; }
.switch .slider::before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: 0.2s; }
.switch.on .slider { background: #2563eb; }
.switch.on .slider::before { transform: translateX(18px); }
.switch.disabled .slider { opacity: 0.6; cursor: default; }
.saved { color: #16a34a; }
.list { list-style: none; padding: 0; display: grid; gap: 0.4rem; }
.noti { display: flex; justify-content: space-between; align-items: center; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.6rem 0.9rem; }
.noti.unread { border-left: 4px solid #2563eb; background: #f8fafc; }
.noti .type { margin-left: 0.5rem; font-size: 0.72rem; color: #2563eb; }
.noti .time { margin-left: 0.5rem; font-size: 0.72rem; color: #9ca3af; }
.noti button { border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 0.35rem 0.7rem; cursor: pointer; }
.empty { text-align: center; margin-top: 2rem; }
</style>
