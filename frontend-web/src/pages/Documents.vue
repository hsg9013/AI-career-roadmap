<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useDocumentsStore, type DocType, type DocumentItem } from 'frontend-shared';
import { downloadPdf, downloadDocx } from '../lib/export/documentExport';

// US3 문서 자동 생성 페이지
// 005 US5(H5): 생성된 문서를 화면 캡처가 아닌 실제 파일(PDF/Word)로 다운로드.

const docs = useDocumentsStore();
const busy = ref(false);
// 003 US1(T022): 마지막 생성 결과의 경로(AI/규칙)를 자연스럽게 안내(오류 아님).
const lastGenerated = ref<DocumentItem | null>(null);

onMounted(() => docs.fetchAll());

const TYPES: { value: DocType; label: string }[] = [
  { value: 'resume', label: '이력서' },
  { value: 'coverletter', label: '자기소개서' },
  { value: 'portfolio', label: '포트폴리오' },
];

async function generate(type: DocType): Promise<void> {
  busy.value = true;
  try {
    lastGenerated.value = await docs.generate(type);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="documents">
    <header><h2>문서 자동 생성</h2>
      <p class="muted">활동 기록을 바탕으로 이력서·자기소개서·포트폴리오 초안을 생성합니다.</p>
    </header>

    <div class="gen">
      <button v-for="t in TYPES" :key="t.value" :disabled="busy" @click="generate(t.value)">
        {{ t.label }} 생성
      </button>
    </div>

    <p v-if="docs.lastError" class="error">{{ docs.lastError }}</p>

    <p v-if="lastGenerated" class="gen-note" :class="lastGenerated.ai_source === 'ai' ? 'ai' : 'rule'">
      <strong>{{ lastGenerated.title }}</strong> 생성 완료 —
      {{ lastGenerated.ai_source === 'ai' ? 'AI가 활동 기록을 바탕으로 작성했습니다.' : '기본 템플릿으로 작성했습니다.' }}
    </p>

    <ul class="list">
      <li v-for="d in docs.documents" :key="d.id" class="doc">
        <div>
          <strong>{{ d.title }}</strong>
          <span class="badge">v{{ d.version }}</span>
          <span class="status" :class="d.status">{{ d.status }}</span>
        </div>
        <div class="doc-actions">
          <button class="dl" @click="downloadPdf(d.title, d.content)">PDF</button>
          <button class="dl" @click="downloadDocx(d.title, d.content)">Word</button>
          <button v-if="d.status !== 'final'" :disabled="busy" @click="docs.finalize(d.id)">확정</button>
        </div>
      </li>
    </ul>
    <p v-if="!docs.loading && docs.documents.length === 0" class="muted empty">아직 생성된 문서가 없습니다.</p>
  </section>
</template>

<style scoped>
.documents { max-width: 760px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.gen { display: flex; gap: 0.5rem; margin: 1rem 0; flex-wrap: wrap; }
.gen button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.55rem 1rem; cursor: pointer; }
.gen button:disabled { opacity: 0.5; }
.error { color: #b91c1c; }
.gen-note { border-radius: 8px; padding: 0.6rem 0.9rem; font-size: 0.9rem; }
.gen-note.ai { background: #eff6ff; color: #1e40af; }
.gen-note.rule { background: #f3f4f6; color: #4b5563; }
.list { list-style: none; padding: 0; display: grid; gap: 0.5rem; }
.doc { display: flex; justify-content: space-between; align-items: center; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.7rem 0.9rem; }
.badge { margin-left: 0.5rem; font-size: 0.75rem; color: #6b7280; }
.status { margin-left: 0.5rem; font-size: 0.72rem; padding: 0.1rem 0.45rem; border-radius: 999px; background: #f3f4f6; }
.status.final { background: #dcfce7; color: #166534; }
.doc-actions { display: flex; gap: 0.4rem; align-items: center; }
.doc-actions .dl { background: #fff; border: 1px solid #2563eb; color: #2563eb; border-radius: 6px; padding: 0.3rem 0.7rem; font-size: 0.82rem; cursor: pointer; }
.doc-actions .dl:hover { background: #eff6ff; }
.empty { text-align: center; margin-top: 2rem; }
</style>
