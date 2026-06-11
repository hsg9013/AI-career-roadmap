<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useFeedsStore, type FeedKind } from 'frontend-shared';

// 003 US5(T041): 외부 수집 정보(채용·자격증·공모전). 신선도 기준 초과는 '최신 아님' 표시.

const store = useFeedsStore();
const active = ref<FeedKind | ''>('');
const refreshing = ref(false);
const refreshedMsg = ref('');

async function refreshNow(): Promise<void> {
  refreshing.value = true;
  refreshedMsg.value = '';
  try {
    await store.refresh();
    refreshedMsg.value = '최신 정보로 새로고침했습니다.';
  } catch {
    refreshedMsg.value = '새로고침에 실패했습니다. 잠시 후 다시 시도하세요.';
  } finally {
    refreshing.value = false;
  }
}

const TABS: { value: FeedKind | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'jobposting', label: '채용' },
  { value: 'certification', label: '자격증' },
  { value: 'contest', label: '공모전' },
];

async function load(kind: FeedKind | ''): Promise<void> {
  active.value = kind;
  await store.fetchItems(kind ? { kind } : {});
}

onMounted(() => load(''));
</script>

<template>
  <section class="feeds">
    <header class="head">
      <div>
        <h2>외부 채용·자격증·공모전</h2>
        <p class="muted">공식 오픈API·제휴 피드에서 일 단위로 수집한 정보입니다.</p>
      </div>
      <button class="refresh" :disabled="refreshing || store.loading" @click="refreshNow">
        {{ refreshing ? '새로고침 중…' : '지금 새로고침' }}
      </button>
    </header>
    <p v-if="refreshedMsg" class="refreshed muted">{{ refreshedMsg }}</p>

    <nav class="tabs">
      <button v-for="t in TABS" :key="t.value" :class="{ active: active === t.value }" @click="load(t.value)">
        {{ t.label }}
      </button>
    </nav>

    <ul class="list">
      <li v-for="it in store.items" :key="it.id" class="item">
        <div class="info">
          <span class="kind">{{ it.kind }}</span>
          <strong>{{ it.title }}</strong>
          <span class="src">{{ it.source }}</span>
        </div>
        <span v-if="it.freshness === 'stale'" class="stale">최신 아님</span>
        <span v-else class="fresh">최신</span>
      </li>
    </ul>
    <p v-if="!store.loading && store.items.length === 0" class="muted empty">수집된 정보가 없습니다.</p>
  </section>
</template>

<style scoped>
.feeds { max-width: 760px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.refresh { padding: 0.5rem 0.9rem; background: #fff; border: 1px solid #2563eb; color: #2563eb; border-radius: 8px; cursor: pointer; font-size: 0.9rem; white-space: nowrap; }
.refresh:hover { background: #eff6ff; }
.refresh:disabled { opacity: 0.55; cursor: not-allowed; }
.refreshed { margin: 0.5rem 0 0; color: #166534; }
.tabs { display: flex; gap: 0.5rem; margin: 1rem 0; flex-wrap: wrap; }
.tabs button { border: 1px solid #d1d5db; background: #fff; border-radius: 999px; padding: 0.35rem 0.9rem; cursor: pointer; }
.tabs button.active { background: #111827; color: #fff; border-color: #111827; }
.list { list-style: none; padding: 0; display: grid; gap: 0.5rem; }
.item { display: flex; justify-content: space-between; align-items: center; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.7rem 0.9rem; }
.item .kind { font-size: 0.7rem; text-transform: uppercase; color: #2563eb; margin-right: 0.5rem; }
.item .src { margin-left: 0.5rem; font-size: 0.75rem; color: #9ca3af; }
.stale { font-size: 0.72rem; font-weight: 600; color: #92400e; background: #fef3c7; padding: 0.15rem 0.5rem; border-radius: 999px; white-space: nowrap; }
.fresh { font-size: 0.72rem; font-weight: 600; color: #166534; background: #dcfce7; padding: 0.15rem 0.5rem; border-radius: 999px; white-space: nowrap; }
.empty { text-align: center; margin-top: 2rem; }
</style>
