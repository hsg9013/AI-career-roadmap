<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStudentStore, useMembershipStore, useCatalogStore, GapDiagnosisChart, type TargetJob } from 'frontend-shared';

// T056 Dashboard — 갭 진단 결과를 직무별로 표시. 활동/직무 미설정 시 온보딩으로 유도.
// 004 US7/US8: 추천 채용 광고·제휴 배너(동의·플래그 기준, 미동의/off 시 자동 빈 목록).

const router = useRouter();
const student = useStudentStore();
const market = useMembershipStore();
const catalog = useCatalogStore();
const triggering = ref(false);

function openBanner(id: number, url: string): void {
  void market.trackBanner(id, 'click');
  window.open(url, '_blank', 'noopener');
}

const selectedJobId = ref<number | null>(null);

onMounted(async () => {
  void catalog.load();
  await Promise.all([student.fetchProfile(), student.fetchTargetJobs()]);
  if (student.targetJobs.length === 0) {
    await router.push('/onboarding');
    return;
  }
  const first = student.targetJobs[0]!;
  selectedJobId.value = first.id;
  await student.fetchLatestDiagnosis(first.id);
  void market.fetchAds();
  void market.fetchBanners();
});

const selectedDiagnosis = computed(() =>
  selectedJobId.value !== null ? student.diagnoses[selectedJobId.value] ?? null : null,
);

async function switchJob(job: TargetJob): Promise<void> {
  selectedJobId.value = job.id;
  if (!student.diagnoses[job.id]) {
    await student.fetchLatestDiagnosis(job.id);
  }
}

async function rerunDiagnosis(): Promise<void> {
  if (selectedJobId.value === null) return;
  triggering.value = true;
  try {
    await student.triggerDiagnosis(selectedJobId.value);
  } finally {
    triggering.value = false;
  }
}
</script>

<template>
  <section class="dashboard">
    <header class="head">
      <div>
        <h2>대시보드</h2>
        <p class="muted" v-if="student.profile">
          {{ student.profile.university }} · {{ student.profile.major }} · {{ student.profile.year_in_school }}학년
        </p>
      </div>
      <button class="rerun" :disabled="triggering || selectedJobId === null" @click="rerunDiagnosis">
        {{ triggering ? '진단 중…' : '갭 진단 다시 실행' }}
      </button>
    </header>

    <div class="tabs" v-if="student.targetJobs.length > 0">
      <button
        v-for="job in student.targetJobs"
        :key="job.id"
        :class="['tab', { active: selectedJobId === job.id }]"
        type="button"
        @click="switchJob(job)"
      >
        #{{ job.priority }} {{ catalog.jobLabel(job.industry_code, job.job_role_code) }}
      </button>
    </div>

    <div v-if="selectedDiagnosis" class="chart-wrap">
      <GapDiagnosisChart :diagnosis="selectedDiagnosis" />
    </div>
    <div v-else class="empty">
      <p>이 직무에 대한 진단 이력이 없습니다.</p>
      <button class="rerun" :disabled="triggering" @click="rerunDiagnosis">지금 진단 실행</button>
    </div>

    <p v-if="student.lastError" class="err">{{ student.lastError }}</p>

    <div v-if="market.recommendedAds.length" class="promo">
      <h3>추천 채용·인턴십 <span class="ad-tag">광고</span></h3>
      <ul class="promo-list">
        <li v-for="ad in market.recommendedAds" :key="ad.id" @click="market.trackBanner(ad.id, 'click')">
          <span class="title">{{ ad.title }}</span>
          <span class="muted">{{ catalog.jobLabel(ad.industry_code, ad.job_role_code) }}</span>
        </li>
      </ul>
    </div>

    <div v-if="market.banners.length" class="promo">
      <h3>교육·자격증 제휴 혜택 <span class="ad-tag">광고/제휴</span></h3>
      <ul class="promo-list">
        <li v-for="b in market.banners" :key="b.id" @click="openBanner(b.id, b.landing_url)">
          <span class="title">{{ b.title }}</span>
          <span v-if="b.discount_text" class="discount">{{ b.discount_text }}</span>
        </li>
      </ul>
    </div>

    <p class="footer">
      <router-link to="/onboarding">목표 직무 변경하기</router-link>
    </p>
  </section>
</template>

<style scoped>
.dashboard { max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
.head { display: flex; align-items: flex-end; justify-content: space-between; }
.head h2 { margin: 0; }
.muted { color: #6b7280; font-size: 0.9rem; margin: 0.25rem 0 0; }
.tabs { display: flex; gap: 0.4rem; margin: 1rem 0 1.5rem; flex-wrap: wrap; }
.tab {
  background: #f3f4f6; border: 1px solid transparent; padding: 0.45rem 0.9rem;
  border-radius: 999px; font-size: 0.9rem; cursor: pointer; color: #374151;
}
.tab.active { background: #2563eb; color: #fff; }
.chart-wrap { background: #fff; padding: 1.25rem; border: 1px solid #e5e7eb; border-radius: 8px; }
.empty { text-align: center; color: #6b7280; padding: 3rem 0; }
.rerun {
  padding: 0.5rem 0.9rem; background: #fff; border: 1px solid #d1d5db; border-radius: 4px;
  cursor: pointer; font-size: 0.9rem;
}
.rerun:hover { background: #f9fafb; }
.rerun:disabled { opacity: 0.6; cursor: not-allowed; }
.footer { margin-top: 2rem; font-size: 0.9rem; text-align: center; }
.err { color: #b91c1c; margin-top: 1rem; }
.promo { margin-top: 1.5rem; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.9rem 1.1rem; }
.promo h3 { margin: 0 0 0.5rem; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; }
.ad-tag { font-size: 0.68rem; font-weight: 700; color: #6b7280; background: #f3f4f6; border-radius: 999px; padding: 0.1rem 0.45rem; }
.promo-list { list-style: none; padding: 0; margin: 0; }
.promo-list li { display: flex; align-items: center; gap: 0.7rem; padding: 0.45rem 0; border-bottom: 1px solid #f3f4f6; cursor: pointer; }
.promo-list .title { font-weight: 500; }
.promo-list .muted { margin-left: auto; }
.promo-list .discount { margin-left: auto; color: #b45309; font-size: 0.85rem; }
</style>
