<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getApi } from 'frontend-shared';

// 005 고도화: 교육·활동 플랫폼 제휴사 포털(role=edu_platform)
//   - 성과 요약(피드/배너 수·노출·클릭) + 콘텐츠 발행(/feeds 반영) + 제휴 배너 관리.

interface Overview { partner: { name: string; status: string }; feed_count: number; banner_count: number; banner_active: number; clicks: number; conversions: number }
interface FeedItem { id: number; kind: string; title: string; freshness: string; collected_at: string }
interface Banner { id: number; title: string; landing_url: string; discount_text: string | null; active: number }

const overview = ref<Overview | null>(null);
const feeds = ref<FeedItem[]>([]);
const banners = ref<Banner[]>([]);
const busy = ref(false);
const msg = ref('');

const feedForm = ref<{ kind: 'certification' | 'contest'; title: string }>({ kind: 'certification', title: '' });
const bannerForm = ref<{ title: string; landing_url: string; discount_text: string }>({ title: '', landing_url: '', discount_text: '' });

async function loadAll(): Promise<void> {
  const [o, f, b] = await Promise.all([
    getApi().get<Overview>('/partner-portal/overview'),
    getApi().get<FeedItem[]>('/partner-portal/feed-items'),
    getApi().get<Banner[]>('/partner-portal/banners'),
  ]);
  overview.value = o.data; feeds.value = f.data; banners.value = b.data;
}
onMounted(() => loadAll().catch(() => undefined));

async function addFeed(): Promise<void> {
  if (!feedForm.value.title.trim()) return;
  busy.value = true; msg.value = '';
  try {
    await getApi().post('/partner-portal/feed-items', { kind: feedForm.value.kind, title: feedForm.value.title });
    feedForm.value.title = '';
    msg.value = '콘텐츠가 발행되어 학생 피드(/feeds)에 노출됩니다.';
    await loadAll();
  } finally { busy.value = false; }
}
async function removeFeed(f: FeedItem): Promise<void> {
  if (!window.confirm(`'${f.title}' 콘텐츠를 삭제할까요? 학생 피드에서도 사라집니다.`)) return;
  busy.value = true; msg.value = '';
  try {
    await getApi().delete(`/partner-portal/feed-items/${f.id}`);
    msg.value = '콘텐츠를 삭제했습니다.';
    await loadAll();
  } finally { busy.value = false; }
}
async function addBanner(): Promise<void> {
  if (!bannerForm.value.title.trim() || !bannerForm.value.landing_url.trim()) return;
  busy.value = true; msg.value = '';
  try {
    await getApi().post('/partner-portal/banners', {
      title: bannerForm.value.title,
      landing_url: bannerForm.value.landing_url,
      discount_text: bannerForm.value.discount_text || undefined,
    });
    bannerForm.value = { title: '', landing_url: '', discount_text: '' };
    msg.value = '배너가 등록되었습니다.';
    await loadAll();
  } catch { msg.value = '배너 등록 실패 (링크 형식을 확인하세요).'; }
  finally { busy.value = false; }
}
async function toggleBanner(b: Banner): Promise<void> {
  busy.value = true;
  try {
    await getApi().patch(`/partner-portal/banners/${b.id}`, { active: b.active ? false : true });
    await loadAll();
  } finally { busy.value = false; }
}
const KIND_LABEL: Record<string, string> = { certification: '자격증·교육', contest: '공모전·대외활동' };
</script>

<template>
  <section class="portal">
    <header>
      <h2>제휴사 포털</h2>
      <p class="muted">교육·활동 플랫폼 파트너 — 콘텐츠 발행·배너 관리·노출 성과를 한 곳에서 관리합니다.</p>
    </header>

    <!-- 성과 요약 -->
    <div v-if="overview" class="summary">
      <div class="s-card"><span class="k">발행 콘텐츠</span><b>{{ overview.feed_count }}</b><span class="u">건</span></div>
      <div class="s-card"><span class="k">배너(활성)</span><b>{{ overview.banner_count }}</b><span class="u">/ {{ overview.banner_active }} 활성</span></div>
      <div class="s-card hot"><span class="k">배너 클릭</span><b>{{ overview.clicks }}</b><span class="u">회</span></div>
      <div class="s-card hot"><span class="k">전환</span><b>{{ overview.conversions }}</b><span class="u">회</span></div>
    </div>
    <p v-if="msg" class="ok">{{ msg }}</p>

    <!-- 콘텐츠 발행 -->
    <h3 class="sec">콘텐츠 발행 <span class="muted">(자격증·교육 / 공모전·대외활동 → 학생 피드 노출)</span></h3>
    <div class="form">
      <select v-model="feedForm.kind">
        <option value="certification">자격증·교육</option>
        <option value="contest">공모전·대외활동</option>
      </select>
      <input v-model="feedForm.title" class="grow" placeholder="예: 제휴 클라우드 자격 과정 모집" />
      <button :disabled="busy || !feedForm.title.trim()" @click="addFeed">발행</button>
    </div>
    <ul class="list">
      <li v-for="f in feeds" :key="f.id" class="row">
        <span class="kind">{{ KIND_LABEL[f.kind] ?? f.kind }}</span>
        <span class="title">{{ f.title }}</span>
        <span class="pill" :class="f.freshness">{{ f.freshness === 'fresh' ? '최신' : '최신 아님' }}</span>
        <button class="del" :disabled="busy" title="콘텐츠 삭제" @click="removeFeed(f)">삭제</button>
      </li>
      <li v-if="!feeds.length" class="muted empty">발행한 콘텐츠가 없습니다.</li>
    </ul>

    <!-- 배너 관리 -->
    <h3 class="sec">제휴 배너 관리 <span class="muted">(학생 대시보드 노출)</span></h3>
    <div class="form">
      <input v-model="bannerForm.title" class="grow" placeholder="배너 제목 (예: 토익 단기 과정 30% 할인)" />
      <input v-model="bannerForm.landing_url" class="grow" placeholder="https://landing.example.com" />
      <input v-model="bannerForm.discount_text" placeholder="혜택(선택)" />
      <button :disabled="busy || !bannerForm.title.trim() || !bannerForm.landing_url.trim()" @click="addBanner">등록</button>
    </div>
    <ul class="list">
      <li v-for="b in banners" :key="b.id" class="row">
        <span class="title">{{ b.title }}</span>
        <span v-if="b.discount_text" class="disc">{{ b.discount_text }}</span>
        <span class="link muted">{{ b.landing_url }}</span>
        <button class="toggle" :class="{ on: b.active }" :disabled="busy" @click="toggleBanner(b)">
          {{ b.active ? '노출 중' : '숨김' }}
        </button>
      </li>
      <li v-if="!banners.length" class="muted empty">등록한 배너가 없습니다.</li>
    </ul>
  </section>
</template>

<style scoped>
.portal { max-width: 860px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.ok { color: #166534; font-size: 0.88rem; }
.empty { padding: 0.6rem 0; }
.summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.7rem; margin: 1rem 0; }
.s-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.8rem 1rem; display: flex; align-items: baseline; gap: 0.3rem; }
.s-card .k { font-size: 0.8rem; color: #6b7280; margin-right: auto; }
.s-card b { font-size: 1.4rem; }
.s-card .u { font-size: 0.78rem; color: #6b7280; }
.s-card.hot b { color: #b45309; }
.sec { margin: 1.5rem 0 0.5rem; font-size: 1rem; }
.form { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
.form .grow { flex: 1; min-width: 160px; }
.form input, .form select { border: 1px solid #d1d5db; border-radius: 8px; padding: 0.45rem 0.6rem; }
.form button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.45rem 1rem; cursor: pointer; }
.form button:disabled { opacity: 0.5; cursor: not-allowed; }
.list { list-style: none; padding: 0; display: grid; gap: 0.4rem; }
.row { display: flex; align-items: center; gap: 0.6rem; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.6rem 0.9rem; }
.row .kind { font-size: 0.72rem; font-weight: 700; color: #4338ca; background: #eef2ff; border-radius: 999px; padding: 0.12rem 0.5rem; white-space: nowrap; }
.row .title { font-weight: 500; }
.row .disc { font-size: 0.8rem; color: #b45309; }
.row .link { margin-left: auto; font-size: 0.78rem; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pill { margin-left: auto; font-size: 0.72rem; padding: 0.12rem 0.5rem; border-radius: 999px; }
.pill.fresh { background: #dcfce7; color: #166534; }
.pill.stale { background: #fef3c7; color: #92400e; }
.row .del { border: 1px solid #fecaca; background: #fff; color: #b91c1c; border-radius: 6px; padding: 0.15rem 0.5rem; font-size: 0.74rem; cursor: pointer; }
.row .del:hover { background: #fef2f2; }
.row .del:disabled { opacity: 0.5; cursor: not-allowed; }
.toggle { border: 1px solid #d1d5db; background: #fff; color: #6b7280; border-radius: 999px; padding: 0.2rem 0.7rem; font-size: 0.78rem; cursor: pointer; }
.toggle.on { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
@media (max-width: 720px) { .summary { grid-template-columns: 1fr 1fr; } }
</style>
