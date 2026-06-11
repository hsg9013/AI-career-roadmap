// 005: 의미 없는 텍스트(키보드 난타) 판별.
// 선배 경로 활동(detail)·전공처럼 학생 로드맵에 그대로 노출되는 자유 입력에 사용한다.
// 'sfsdfsdf', 'fsdfsd' 같은 자음 난타를 거르되, 한글/정상 영문 단어는 통과시킨다.
//
// 판정: 한글이 있으면 의미 있음. 영문은 토큰 단위로 보아 '긴 자음 덩어리(5+)가 없거나
//       모음 비율이 충분(≥0.2)' 한 토큰이 하나라도 있으면 의미 있는 것으로 본다.
export function isMeaningfulText(input: string): boolean {
  const t = input.trim();
  if (t.length === 0) return false;
  if (/[가-힣]/.test(t)) return true; // 한글 포함 → 의미 있음

  const tokens = t.split(/\s+/).filter(Boolean);
  return tokens.some((tok) => {
    const letters = tok.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return /\d/.test(tok); // 숫자만 있는 토큰은 허용(예: '2024')
    const hasLongConsonantRun = /[bcdfghjklmnpqrstvwxz]{5,}/i.test(letters);
    if (!hasLongConsonantRun) return true; // 긴 자음 덩어리 없으면 단어다움
    const vowels = (letters.match(/[aeiouy]/gi) ?? []).length;
    return vowels / letters.length >= 0.2;
  });
}
