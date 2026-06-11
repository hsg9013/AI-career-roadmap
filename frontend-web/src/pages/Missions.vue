<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useMissionsStore, useAuthStore, useCatalogStore, getApi, type Mission, type SubmissionFeedback } from 'frontend-shared';

// US4 실무 미션 + AI 1차 피드백 페이지
// 005 US4(H4): 멘토 계정은 배정된 제출물에 심층 코멘트를 작성한다.

const store = useMissionsStore();
const auth = useAuthStore();
const catalog = useCatalogStore();
const isMentor = computed(() => auth.user?.role === 'mentor');

const busy = ref(false);
const openId = ref<number | null>(null);
const content = ref('');
const aiFeedback = ref<string | null>(null);

// 005 US4: 학생 '내 제출물·피드백'
const expandedSub = ref<number | null>(null);
const subFeedback = ref<SubmissionFeedback | null>(null);
const fbLoading = ref(false);
const STATE_LABEL: Record<string, string> = {
  submitted: '제출됨', ai_reviewed: 'AI 검토 완료', assigned: '멘토 검수 중',
  mentor_reviewed: '멘토 검수 완료', reassigned: '재배정', ai_fallback: 'AI 대체 검토',
};
const REVIEW_LABEL: Record<string, string> = {
  pending: '검수 대기', completed: '검수 완료', reassigned: '재배정', ai_fallback: 'AI 대체',
};
async function toggleFeedback(submissionId: number): Promise<void> {
  if (expandedSub.value === submissionId) {
    expandedSub.value = null;
    subFeedback.value = null;
    return;
  }
  fbLoading.value = true;
  expandedSub.value = submissionId;
  subFeedback.value = null;
  try {
    subFeedback.value = await store.feedback(submissionId);
  } finally {
    fbLoading.value = false;
  }
}

// 멘토 전용 상태
interface Assignment {
  submission_id: number;
  content: string | null;
  mission_title: string;
  deadline: string;
}
const assignments = ref<Assignment[]>([]);
const commentFor = ref<number | null>(null);
const comment = ref('');
const mentorMsg = ref('');

async function fetchAssignments(): Promise<void> {
  const { data } = await getApi().get<Assignment[]>('/mentor/submissions');
  assignments.value = data;
}

async function submitComment(submissionId: number): Promise<void> {
  if (comment.value.trim().length === 0) return;
  busy.value = true;
  try {
    await getApi().post(`/mentor/submissions/${submissionId}/feedback`, { content: comment.value });
    mentorMsg.value = '심층 코멘트가 학생에게 전달되었습니다.';
    comment.value = '';
    commentFor.value = null;
    await fetchAssignments();
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void catalog.load();
  if (isMentor.value) void fetchAssignments();
  else {
    void store.fetchAll();
    void store.fetchMySubmissions();
  }
});

function open(m: Mission): void {
  openId.value = m.id;
  content.value = '';
  aiFeedback.value = null;
}

async function submit(): Promise<void> {
  if (openId.value === null || content.value.trim().length === 0) return;
  busy.value = true;
  try {
    const res = await store.submit(openId.value, content.value);
    aiFeedback.value = res.ai_feedback;
    openId.value = null;
    await store.fetchMySubmissions(); // 제출 직후 내 제출물 목록 갱신
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="missions">
    <!-- 005 US4(H4): 멘토 뷰 — 배정된 제출물에 심층 코멘트 작성 -->
    <template v-if="isMentor">
      <header><h2>현직자 검수</h2>
        <p class="muted">배정된 학생 제출물에 심층 코멘트를 작성하면 AI 1차 피드백과 결합되어 학생에게 전달됩니다.</p>
      </header>

      <!-- item4: 멘토(현직자) 역할·보상 안내 -->
      <div class="saas-banner">
        <span class="saas-badge">현직자 멘토 · 지식 공급 파트너</span>
        <p class="saas-purpose"><b>목적</b> — 현직 경험으로 학생 제출물에 <b>심층 코멘트</b>를 제공하고, 미션 출제·합격 경험 공유로 취준생의 취업 준비를 돕습니다.</p>
        <p class="saas-plan"><b>보상</b> — 검수 코멘트 <b>건당 정산</b>(정액 또는 채용 수수료 트랙) · 합격 경험 공유 시 배지/적립. 정산 현황은 '알림'에서 확인합니다.</p>
      </div>

      <p v-if="mentorMsg" class="feedback">{{ mentorMsg }}</p>
      <ul class="list">
        <li v-for="a in assignments" :key="a.submission_id" class="mission">
          <div class="info">
            <strong>{{ a.mission_title }}</strong>
            <span class="role">마감 {{ a.deadline?.slice(0, 10) }}</span>
            <p class="muted">{{ a.content || '(제출 내용 없음)' }}</p>
            <div v-if="commentFor === a.submission_id" class="composer">
              <textarea v-model="comment" rows="4" placeholder="심층 코멘트를 작성하세요"></textarea>
              <button :disabled="busy || comment.trim().length === 0" @click="submitComment(a.submission_id)">
                {{ busy ? '전달 중…' : '코멘트 전달' }}
              </button>
            </div>
          </div>
          <button v-if="commentFor !== a.submission_id" @click="commentFor = a.submission_id">코멘트</button>
        </li>
        <li v-if="!assignments.length" class="muted">배정된 검수 대기 제출물이 없습니다.</li>
      </ul>
    </template>

    <!-- 학생 뷰 -->
    <template v-else>
    <header><h2>실무 미션</h2>
      <p class="muted">미션을 제출하면 AI 1차 피드백이 즉시 제공되고, 현직자 코멘트가 5영업일 내 결합됩니다.</p>
    </header>

    <ul class="list">
      <li v-for="m in store.missions" :key="m.id" class="mission">
        <div class="info">
          <strong>{{ m.title }}</strong>
          <span v-if="m.job_role_code" class="role">{{ catalog.jobLabel(m.industry_code, m.job_role_code) }}</span>
          <p class="muted">{{ m.brief }}</p>
        </div>
        <button @click="open(m)">제출</button>
      </li>
    </ul>

    <div v-if="openId !== null" class="composer">
      <h3>미션 제출</h3>
      <textarea v-model="content" rows="6" placeholder="제출 내용을 작성하세요 (문제정의 → 접근 → 결과)"></textarea>
      <button :disabled="busy || content.trim().length === 0" @click="submit">
        {{ busy ? '제출 중…' : '제출하고 AI 피드백 받기' }}
      </button>
      <p v-if="aiFeedback" class="feedback">{{ aiFeedback }}</p>
    </div>

    <!-- 005 US4: 내 제출물·피드백 -->
    <section class="my-subs">
      <h3>내 제출물·피드백</h3>
      <ul class="list">
        <li v-for="s in store.mySubmissions" :key="s.submission_id" class="sub">
          <div class="sub-head" @click="toggleFeedback(s.submission_id)">
            <div class="sub-info">
              <strong>{{ s.mission_title }}</strong>
              <span class="role">{{ catalog.jobLabel(s.industry_code, s.job_role_code) }}</span>
            </div>
            <div class="sub-meta">
              <span class="state">{{ STATE_LABEL[s.state] ?? s.state }}</span>
              <span v-if="s.review_status" class="review" :class="s.review_status">
                {{ REVIEW_LABEL[s.review_status] ?? s.review_status }}
              </span>
              <span v-if="s.has_mentor_feedback" class="badge-mentor">멘토 코멘트 ✓</span>
              <span class="toggle">{{ expandedSub === s.submission_id ? '▲' : '▼' }}</span>
            </div>
          </div>
          <div v-if="expandedSub === s.submission_id" class="sub-fb">
            <p v-if="fbLoading" class="muted">불러오는 중…</p>
            <template v-else-if="subFeedback">
              <div v-for="(f, i) in subFeedback.feedbacks" :key="i" class="fb-item" :class="f.kind">
                <span class="fb-tag">{{ f.kind === 'mentor' ? '현직자 코멘트' : 'AI 피드백' }}</span>
                <p>{{ f.content }}</p>
              </div>
              <p v-if="subFeedback.feedbacks.length === 0" class="muted">아직 피드백이 없습니다.</p>
            </template>
          </div>
        </li>
        <li v-if="!store.mySubmissions.length" class="muted empty">아직 제출한 미션이 없습니다.</li>
      </ul>
    </section>
    </template>
  </section>
</template>

<style scoped>
.missions { max-width: 760px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.list { list-style: none; padding: 0; display: grid; gap: 0.5rem; }
.mission { display: flex; justify-content: space-between; gap: 1rem; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.7rem 0.9rem; }
.mission .role { margin-left: 0.5rem; font-size: 0.78rem; color: #2563eb; }
.mission button, .composer button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.5rem 1rem; cursor: pointer; align-self: center; }
.composer { margin-top: 1.5rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
.composer textarea { width: 100%; box-sizing: border-box; margin-bottom: 0.5rem; }
.feedback { background: #eff6ff; border-radius: 8px; padding: 0.7rem; margin-top: 0.7rem; }
.my-subs { margin-top: 1.8rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
.my-subs h3 { font-size: 1.02rem; margin: 0 0 0.6rem; }
.sub { border: 1px solid #e5e7eb; border-radius: 10px; padding: 0; overflow: hidden; }
.sub-head { display: flex; justify-content: space-between; align-items: center; gap: 0.8rem; padding: 0.7rem 0.9rem; cursor: pointer; }
.sub-head:hover { background: #f9fafb; }
.sub-info strong { font-size: 0.92rem; }
.sub-info .role { margin-left: 0.5rem; font-size: 0.76rem; color: #2563eb; }
.sub-meta { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; white-space: nowrap; }
.sub-meta .state { color: #6b7280; }
.sub-meta .review { padding: 0.1rem 0.45rem; border-radius: 999px; background: #fef3c7; color: #92400e; }
.sub-meta .review.completed { background: #dcfce7; color: #166534; }
.badge-mentor { padding: 0.1rem 0.45rem; border-radius: 999px; background: #ede9fe; color: #5b21b6; font-weight: 600; }
.sub-meta .toggle { color: #9ca3af; }
.sub-fb { border-top: 1px solid #f3f4f6; padding: 0.7rem 0.9rem; background: #fcfcfd; }
.fb-item { border-left: 3px solid #93c5fd; padding: 0.3rem 0 0.3rem 0.7rem; margin: 0.4rem 0; }
.fb-item.mentor { border-left-color: #8b5cf6; }
.fb-item .fb-tag { font-size: 0.72rem; font-weight: 700; color: #4b5563; }
.fb-item.mentor .fb-tag { color: #6d28d9; }
.fb-item p { margin: 0.2rem 0 0; font-size: 0.88rem; line-height: 1.5; }
.empty { padding: 0.6rem 0; }
.saas-banner { border: 1px solid #ddd6fe; background: #f5f3ff; border-radius: 12px; padding: 0.9rem 1.1rem; margin: 1rem 0; }
.saas-badge { display: inline-block; font-size: 0.72rem; font-weight: 700; color: #fff; background: #6d28d9; border-radius: 999px; padding: 0.15rem 0.6rem; margin-bottom: 0.4rem; }
.saas-purpose, .saas-plan { margin: 0.25rem 0; font-size: 0.88rem; color: #4c1d95; }
</style>
