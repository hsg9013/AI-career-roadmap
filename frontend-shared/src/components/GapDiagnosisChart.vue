<script setup lang="ts">
import { computed } from 'vue';
import type { GapDiagnosis } from '../stores/student.js';

// T055: 갭 진단 결과 시각화.
// 외부 차트 라이브러리 없이 SVG/CSS 만으로 그린다 — 모바일 번들 크기 우려 및 의존성 최소화.

const props = defineProps<{
  diagnosis: GapDiagnosis;
}>();

const scoreColor = computed(() => {
  const s = props.diagnosis.overall_score;
  if (s >= 75) return '#16a34a'; // green
  if (s >= 40) return '#eab308'; // amber
  return '#dc2626'; // red
});

const radius = 56;
const circumference = 2 * Math.PI * radius;
const dash = computed(() => (props.diagnosis.overall_score / 100) * circumference);

// 003 US1(T022): AI/규칙 경로를 사용자 친화적으로 표시. 폴백은 오류가 아닌 '기본 분석'으로 안내.
const insightBadge = computed(() => {
  const src = props.diagnosis.insight?.source;
  return src === 'llm' || src === 'cache'
    ? { label: 'AI 분석', cls: 'ai' }
    : { label: '기본 분석', cls: 'rule' };
});
</script>

<template>
  <section class="chart">
    <div class="score-wrap">
      <svg viewBox="0 0 140 140" class="ring">
        <circle cx="70" cy="70" :r="radius" class="track" />
        <circle
          cx="70"
          cy="70"
          :r="radius"
          class="value"
          :stroke="scoreColor"
          :stroke-dasharray="`${dash} ${circumference}`"
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="72" class="label" text-anchor="middle" :fill="scoreColor">
          {{ diagnosis.overall_score.toFixed(1) }}
        </text>
        <text x="70" y="92" class="unit" text-anchor="middle">점</text>
      </svg>
      <p class="model">model: {{ diagnosis.model_version }}</p>
    </div>

    <div class="lists">
      <div class="col">
        <h4>충족 ({{ diagnosis.payload.fulfilled.length }})</h4>
        <ul>
          <li v-for="k in diagnosis.payload.fulfilled" :key="k" class="tag fulfilled">{{ k }}</li>
          <li v-if="diagnosis.payload.fulfilled.length === 0" class="empty">아직 매칭된 역량이 없습니다</li>
        </ul>
      </div>
      <div class="col">
        <h4>우선 보완 ({{ diagnosis.payload.priority_to_improve.length }})</h4>
        <ul>
          <li v-for="k in diagnosis.payload.priority_to_improve" :key="k" class="tag priority">{{ k }}</li>
        </ul>
      </div>
      <div class="col">
        <h4>전체 부족 ({{ diagnosis.payload.missing.length }})</h4>
        <ul class="muted">
          <li v-for="k in diagnosis.payload.missing" :key="k" class="tag missing">{{ k }}</li>
        </ul>
      </div>
    </div>

    <div v-if="diagnosis.insight" class="insight">
      <div class="insight-head">
        <span class="ai-badge" :class="insightBadge.cls">{{ insightBadge.label }}</span>
      </div>
      <p class="narrative">{{ diagnosis.insight.narrative }}</p>
      <ul v-if="diagnosis.insight.suggestions.length > 0" class="suggestions">
        <li v-for="(s, i) in diagnosis.insight.suggestions" :key="i">{{ s }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.chart { display: flex; flex-direction: column; gap: 1.25rem; }
.score-wrap { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
.ring { width: 140px; height: 140px; }
.track { fill: none; stroke: #e5e7eb; stroke-width: 12; }
.value { fill: none; stroke-width: 12; stroke-linecap: round; transition: stroke-dasharray 0.5s ease; }
.label { font-size: 1.6rem; font-weight: 700; }
.unit { font-size: 0.8rem; fill: #6b7280; }
.model { color: #9ca3af; font-size: 0.75rem; margin: 0; }

.lists { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.col h4 { margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #374151; }
.col ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.3rem; }
.tag { font-size: 0.8rem; padding: 0.2rem 0.55rem; border-radius: 999px; }
.tag.fulfilled { background: #dcfce7; color: #15803d; }
.tag.priority { background: #fef3c7; color: #92400e; }
.tag.missing { background: #fee2e2; color: #991b1b; }
.empty { color: #9ca3af; font-size: 0.85rem; }
.muted { opacity: 0.85; }

.insight {
  border-left: 3px solid #2563eb; background: #eff6ff; padding: 0.8rem 1rem; border-radius: 4px;
}
.insight .narrative { margin: 0 0 0.5rem; }
.insight .suggestions { margin: 0; padding-left: 1.2rem; color: #1e3a8a; }
.insight-head { margin-bottom: 0.4rem; }
.ai-badge { font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 999px; }
.ai-badge.ai { background: #dbeafe; color: #1e40af; }
.ai-badge.rule { background: #f3f4f6; color: #4b5563; }
</style>
