<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useMissionsStore, useAuthStore, useCatalogStore, getApi, type Mission } from 'frontend-shared';

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
  else void store.fetchAll();
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
</style>
