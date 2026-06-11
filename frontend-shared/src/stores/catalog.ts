import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getApi } from '../api/client.js';

// 014: 산업·직무 코드 → 한글명 매핑 스토어.
//   대시보드/로드맵/미션 등은 target_jobs 의 코드(industry_code/job_role_code)만 받으므로
//   화면에 영어 코드가 그대로 노출됐다. 카탈로그(한글명)를 1회 로드해 코드→한글로 표시한다.
//   라벨 로드 실패 시 코드로 폴백(graceful degrade).

export const useCatalogStore = defineStore('catalog', () => {
  const industryName = ref<Record<string, string>>({});
  const jobRoleName = ref<Record<string, string>>({}); // key: `${industry_code}/${job_role_code}`
  const loaded = ref(false);
  let inflight: Promise<void> | null = null;

  async function doLoad(): Promise<void> {
    const [ind, jobs] = await Promise.all([
      getApi().get<{ items: Array<{ code: string; name: string }> }>('/catalog/industries'),
      getApi().get<{ items: Array<{ code: string; industry_code: string; name: string }> }>(
        '/catalog/job-roles',
      ),
    ]);
    const im: Record<string, string> = {};
    for (const i of ind.data.items) im[i.code] = i.name;
    const jm: Record<string, string> = {};
    for (const j of jobs.data.items) jm[`${j.industry_code}/${j.code}`] = j.name;
    industryName.value = im;
    jobRoleName.value = jm;
    loaded.value = true;
  }

  // 멱등 로드(중복 호출은 1회로 합침). 실패는 삼켜 코드 폴백.
  async function load(): Promise<void> {
    if (loaded.value) return;
    if (!inflight) inflight = doLoad().catch(() => undefined).finally(() => { inflight = null; });
    return inflight;
  }

  function industryLabel(code: string | null | undefined): string {
    if (!code) return '';
    return industryName.value[code] ?? code;
  }
  function jobRoleLabel(industryCode: string | null | undefined, code: string | null | undefined): string {
    if (!code) return '';
    return jobRoleName.value[`${industryCode ?? ''}/${code}`] ?? code;
  }
  // "산업 / 직무" 한글 라벨(미로딩 시 코드 폴백).
  function jobLabel(industryCode: string | null | undefined, jobRoleCode: string | null | undefined): string {
    const ind = industryLabel(industryCode);
    const role = jobRoleLabel(industryCode, jobRoleCode);
    return ind && role ? `${ind} / ${role}` : ind || role;
  }

  return { industryName, jobRoleName, loaded, load, industryLabel, jobRoleLabel, jobLabel };
});
