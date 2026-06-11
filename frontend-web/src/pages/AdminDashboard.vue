<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useAdminStore, type UsageBucket } from 'frontend-shared';

// 관리자 대시보드 — 사용 지표 + 004 파트너/라이선스 콘솔(운영자 수동 등록).

const admin = useAdminStore();
onMounted(() => {
  admin.fetchUsage().catch(() => undefined);
  admin.fetchPartners('pending').catch(() => undefined); // 010: 승인 대기 파트너
});

// 010: 파트너 가입 승인/거절
const approveMsg = ref('');
async function decide(id: number, status: 'active' | 'rejected'): Promise<void> {
  approveMsg.value = '';
  try {
    await admin.setPartnerStatus(id, status);
    approveMsg.value = status === 'active' ? '승인되었습니다 (로그인 활성화).' : '거절 처리되었습니다.';
    await admin.fetchPartners('pending');
  } catch {
    approveMsg.value = '처리 실패';
  }
}
const PARTNER_TYPE_LABEL: Record<string, string> = {
  university: '대학', company: '기업', mentor_org: '멘토 조직', edu_platform: '교육·활동 플랫폼', tech_partner: '기술 협력사',
};

function maxOf(rows: UsageBucket[]): number {
  return rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
}
const u = computed(() => admin.usage);

// 004 US5/US9: 파트너·라이선스 등록 콘솔
const partnerForm = ref<{ type: 'university' | 'company' | 'mentor_org' | 'edu_platform' | 'tech_partner'; name: string; consent_scope: 'none' | 'stats' | 'individual' }>(
  { type: 'university', name: '', consent_scope: 'stats' },
);
const licenseForm = ref<{ partner_id: number | null; type: 'university_saas' | 'company_recruit'; fee_year: number | null }>(
  { partner_id: null, type: 'university_saas', fee_year: null },
);
const partnerMsg = ref('');
const licenseMsg = ref('');

async function submitPartner(): Promise<void> {
  if (!partnerForm.value.name) return;
  await admin.createPartner(partnerForm.value).then(() => {
    partnerMsg.value = `파트너 등록됨 (#${admin.lastPartnerId})`;
    licenseForm.value.partner_id = admin.lastPartnerId;
    partnerForm.value.name = '';
  }).catch(() => { partnerMsg.value = '등록 실패'; });
}
async function submitLicense(): Promise<void> {
  if (!licenseForm.value.partner_id) return;
  await admin.createLicense({
    partner_id: licenseForm.value.partner_id,
    type: licenseForm.value.type,
    fee_year: licenseForm.value.fee_year ?? undefined,
  }).then(() => { licenseMsg.value = '라이선스 등록됨'; }).catch(() => { licenseMsg.value = '등록 실패'; });
}
</script>

<template>
  <section class="admin">
    <header>
      <h2>관리자 대시보드</h2>
      <p class="muted">사용 이벤트 지표 — 서비스유형 · 기간 · 사용자별 분포</p>
    </header>

    <p v-if="admin.lastError" class="error">{{ admin.lastError }}</p>
    <p v-if="admin.loading" class="muted">불러오는 중…</p>

    <template v-if="u">
      <div class="total">총 이벤트 <b>{{ u.total }}</b>건</div>

      <div class="charts">
        <div class="chart">
          <h3>서비스 유형별</h3>
          <ul>
            <li v-for="r in u.byType" :key="r.key">
              <span class="lbl">{{ r.key }}</span>
              <span class="track"><span class="fill type" :style="{ width: (r.count / maxOf(u.byType) * 100) + '%' }"></span></span>
              <span class="val">{{ r.count }}</span>
            </li>
          </ul>
        </div>

        <div class="chart">
          <h3>기간(월)별</h3>
          <ul>
            <li v-for="r in u.byPeriod" :key="r.key">
              <span class="lbl">{{ r.key }}</span>
              <span class="track"><span class="fill period" :style="{ width: (r.count / maxOf(u.byPeriod) * 100) + '%' }"></span></span>
              <span class="val">{{ r.count }}</span>
            </li>
          </ul>
        </div>

        <div class="chart">
          <h3>사용자별 (상위 20)</h3>
          <ul>
            <li v-for="r in u.byUser" :key="r.key">
              <span class="lbl">#{{ r.key }}</span>
              <span class="track"><span class="fill user" :style="{ width: (r.count / maxOf(u.byUser) * 100) + '%' }"></span></span>
              <span class="val">{{ r.count }}</span>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <div class="approval">
      <h3>파트너 가입 승인 대기 <span class="muted">(자체 가입 — 승인 전 로그인 불가)</span></h3>
      <p v-if="approveMsg" class="ok">{{ approveMsg }}</p>
      <table v-if="admin.partners.length" class="ptable">
        <thead>
          <tr><th>기관/이름</th><th>유형</th><th>담당자</th><th>신청일</th><th>처리</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in admin.partners" :key="p.id">
            <td>{{ p.name }}</td>
            <td>{{ PARTNER_TYPE_LABEL[p.type] ?? p.type }}</td>
            <td>{{ p.email ?? '(로그인 계정 없음)' }}</td>
            <td class="muted">{{ p.created_at?.slice(0, 10) }}</td>
            <td class="actions">
              <button class="approve" @click="decide(p.id, 'active')">승인</button>
              <button class="reject" @click="decide(p.id, 'rejected')">거절</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">승인 대기 중인 파트너가 없습니다.</p>
    </div>

    <div class="console">
      <h3>파트너·라이선스 콘솔 <span class="muted">(운영자 수동 등록)</span></h3>
      <div class="forms">
        <div class="card">
          <h4>파트너 등록</h4>
          <select v-model="partnerForm.type">
            <option value="university">대학교</option>
            <option value="company">기업</option>
            <option value="mentor_org">멘토 조직</option>
            <option value="edu_platform">교육/활동 플랫폼</option>
            <option value="tech_partner">기술 협력사</option>
          </select>
          <input v-model="partnerForm.name" placeholder="파트너 이름" />
          <select v-model="partnerForm.consent_scope">
            <option value="none">공유 안 함</option>
            <option value="stats">통계만</option>
            <option value="individual">개인 단위</option>
          </select>
          <button @click="submitPartner">등록</button>
          <p v-if="partnerMsg" class="ok">{{ partnerMsg }}</p>
        </div>
        <div class="card">
          <h4>라이선스 등록</h4>
          <input v-model.number="licenseForm.partner_id" type="number" placeholder="파트너 ID" />
          <select v-model="licenseForm.type">
            <option value="university_saas">대학 SaaS(연간)</option>
            <option value="company_recruit">기업 채용 수수료</option>
          </select>
          <input v-model.number="licenseForm.fee_year" type="number" placeholder="연 라이선스 금액(선택)" />
          <button @click="submitLicense">등록</button>
          <p v-if="licenseMsg" class="ok">{{ licenseMsg }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin { max-width: 1000px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.error { color: #b91c1c; }
.total { margin: 0.5rem 0 1rem; font-size: 1rem; }
.total b { font-size: 1.3rem; color: #2563eb; }
.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.chart { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem; }
.chart h3 { margin: 0 0 0.7rem; font-size: 1rem; }
.chart ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.35rem; }
.chart li { display: grid; grid-template-columns: 110px 1fr 36px; align-items: center; gap: 0.5rem; font-size: 0.82rem; }
.lbl { color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track { background: #f3f4f6; border-radius: 999px; height: 14px; overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 999px; }
.fill.type { background: #2563eb; }
.fill.period { background: #059669; }
.fill.user { background: #d97706; }
.val { text-align: right; color: #111; font-variant-numeric: tabular-nums; }
@media (max-width: 720px) { .charts { grid-template-columns: 1fr; } }
.approval { margin-top: 2rem; border-top: 1px solid #e5e7eb; padding-top: 1.2rem; }
.approval h3 { font-size: 1.05rem; }
.ptable { width: 100%; border-collapse: collapse; margin-top: 0.6rem; font-size: 0.88rem; }
.ptable th, .ptable td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid #f3f4f6; }
.ptable th { color: #6b7280; font-weight: 600; }
.ptable .actions { display: flex; gap: 0.4rem; }
.ptable .approve { background: #16a34a; color: #fff; border: 0; border-radius: 6px; padding: 0.3rem 0.7rem; cursor: pointer; }
.ptable .reject { background: #fff; color: #b91c1c; border: 1px solid #fecaca; border-radius: 6px; padding: 0.3rem 0.7rem; cursor: pointer; }
.console { margin-top: 2rem; border-top: 1px solid #e5e7eb; padding-top: 1.2rem; }
.console h3 { font-size: 1.05rem; }
.forms { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.8rem; }
.card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.card h4 { margin: 0 0 0.3rem; }
.card input, .card select { border: 1px solid #d1d5db; border-radius: 8px; padding: 0.45rem 0.6rem; }
.card button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.5rem; cursor: pointer; }
.ok { color: #166534; font-size: 0.85rem; margin: 0.2rem 0 0; }
@media (max-width: 720px) { .forms { grid-template-columns: 1fr; } }
</style>
