<script setup lang="ts">
import { onMounted } from 'vue';
import { useNotificationsStore } from 'frontend-shared';

// US5 알림 센터

const store = useNotificationsStore();
onMounted(() => store.fetchAll());
</script>

<template>
  <section class="notifications">
    <header><h2>알림</h2></header>
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
.muted { color: #6b7280; }
.list { list-style: none; padding: 0; display: grid; gap: 0.4rem; }
.noti { display: flex; justify-content: space-between; align-items: center; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.6rem 0.9rem; }
.noti.unread { border-left: 4px solid #2563eb; background: #f8fafc; }
.noti .type { margin-left: 0.5rem; font-size: 0.72rem; color: #2563eb; }
.noti .time { margin-left: 0.5rem; font-size: 0.72rem; color: #9ca3af; }
.noti button { border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 0.35rem 0.7rem; cursor: pointer; }
.empty { text-align: center; margin-top: 2rem; }
</style>
