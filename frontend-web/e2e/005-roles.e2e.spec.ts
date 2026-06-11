import { test, expect, type Page } from '@playwright/test';

// 005 T040: 역할별 실동작 E2E.
// 데모 계정(seed:005, 비번 demo1234!)을 사용한다.
// 주의: dev 백엔드는 /auth 에 레이트리밋(30회/60초, IP 기준)이 걸려 있다. 본 스위트는
//       1회 실행 시 ~16 auth 호출로 한도 내이지만, 60초 안에 반복 실행하면 429 로
//       로그인이 막혀 flaky 해진다. 재실행은 ~1분 간격을 두거나 NODE_ENV=test 백엔드로 돌릴 것.
const PW = 'demo1234!';
const STUDENT = 'demo-student-backend@p16.local';
const MENTOR = 'demo-mentor-backend@p16.local';
const ENTERPRISE = 'demo-enterprise@p16.local';

async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.locator('button.submit').click();
  // performLogin → /dashboard 로 이동(로그인 페이지 이탈).
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 });
}

const navLink = (page: Page, label: string) =>
  page.locator('header nav').getByRole('link', { name: label, exact: true });

test.describe('US2(H2) 세션 — 새로고침 유지 / 로그아웃 메인 이동', () => {
  test('새로고침(F5)해도 로그인 상태가 유지된다', async ({ page }) => {
    await login(page, STUDENT);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();

    // refresh 쿠키 기반 부팅 복원(main.ts restoreSession) — 새로고침 후에도 보호 페이지 접근 유지.
    await page.reload();
    await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);

    // 보호 라우트로 직접 이동해도 /login 으로 튕기지 않는다(세션 복원 확인).
    await page.goto('/documents');
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();
  });

  test('로그아웃 시 메인(/)으로 이동하고 로그인 링크가 보인다', async ({ page }) => {
    await login(page, STUDENT);
    await page.getByRole('button', { name: '로그아웃' }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
    await expect(navLink(page, '로그인')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그아웃' })).toHaveCount(0);
  });
});

test.describe('US3(H3) 권한 — 역할별 메뉴 종속', () => {
  test('학생: 학생 메뉴만 노출(기업/대학/관리자 메뉴 없음)', async ({ page }) => {
    await login(page, STUDENT);
    await expect(navLink(page, '활동·스펙')).toBeVisible();
    await expect(navLink(page, '로드맵')).toBeVisible();
    await expect(navLink(page, '문서')).toBeVisible();
    await expect(navLink(page, '멤버십')).toBeVisible();
    await expect(navLink(page, '인재 검색')).toHaveCount(0);
    await expect(navLink(page, '대학 대시보드')).toHaveCount(0);
  });

  test('멘토: 멘토 메뉴만 노출(학생 전용 메뉴 없음)', async ({ page }) => {
    await login(page, MENTOR);
    await expect(navLink(page, '미션')).toBeVisible();
    await expect(navLink(page, '합격 경험 공유')).toBeVisible();
    await expect(navLink(page, '알림')).toBeVisible();
    await expect(navLink(page, '활동·스펙')).toHaveCount(0);
    await expect(navLink(page, '문서')).toHaveCount(0);
    await expect(navLink(page, '멤버십')).toHaveCount(0);
  });

  test('기업: 인재 검색 메뉴 노출(학생 전용 메뉴 없음)', async ({ page }) => {
    await login(page, ENTERPRISE);
    await expect(navLink(page, '인재 검색')).toBeVisible();
    await expect(navLink(page, '활동·스펙')).toHaveCount(0);
    await expect(navLink(page, '로드맵')).toHaveCount(0);
  });
});

test.describe('US5(H5) 문서 — PDF/Word 실다운로드', () => {
  test('이력서 생성 후 PDF·Word 파일이 실제로 다운로드된다', async ({ page }) => {
    await login(page, STUDENT);
    await page.goto('/documents');
    await expect(page).toHaveURL(/\/documents$/);

    // 문서 1건 생성(기존 문서가 있어도 무방 — 목록에 최소 1건 보장).
    await page.getByRole('button', { name: '이력서 생성' }).click();
    const firstDoc = page.locator('ul.list li.doc').first();
    await expect(firstDoc).toBeVisible({ timeout: 15_000 });

    // PDF 다운로드(jsPDF) — 실제 download 이벤트 + .pdf 확장자.
    const pdfWait = page.waitForEvent('download', { timeout: 15_000 });
    await firstDoc.getByRole('button', { name: 'PDF' }).click();
    const pdf = await pdfWait;
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);

    // Word 다운로드(docx) — 실제 download 이벤트 + .docx 확장자.
    const docxWait = page.waitForEvent('download', { timeout: 15_000 });
    await firstDoc.getByRole('button', { name: 'Word' }).click();
    const docx = await docxWait;
    expect(docx.suggestedFilename()).toMatch(/\.docx$/);
  });
});
