// 005 US5(H5): 활동 기반 자동 문서를 화면 캡처가 아닌 실제 다운로드 가능한 파일(PDF/Word)로 생성.
//   PDF = jsPDF, Word(.docx) = docx 라이브러리. 버튼 클릭 시 브라우저가 실제 파일을 내려받는다.
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

// 문서 content(unknown)를 표시용 라인 배열로 평탄화. 문자열/배열/객체를 모두 안전 처리.
export function contentToLines(content: unknown): string[] {
  if (content == null) return [];
  if (typeof content === 'string') return content.split('\n');
  if (Array.isArray(content)) return content.flatMap((v) => contentToLines(v));
  if (typeof content === 'object') {
    const out: string[] = [];
    for (const [k, v] of Object.entries(content as Record<string, unknown>)) {
      if (v != null && typeof v === 'object') {
        out.push(`【${k}】`, ...contentToLines(v));
      } else {
        out.push(`${k}: ${String(v)}`);
      }
    }
    return out;
  }
  return [String(content)];
}

function safeFileName(title: string): string {
  return (title || 'document').replace(/[\\/:*?"<>|]+/g, '_').trim();
}

// 005 US5(H5) 한글 PDF: jsPDF 기본 폰트(Helvetica)는 한글을 지원하지 않아 깨진다.
//   public/fonts 의 NanumGothic(.ttf)을 1회 fetch→base64 등록해 한글을 정상 렌더한다.
const KOREAN_FONT_NAME = 'NanumGothic';
const KOREAN_FONT_FILE = 'NanumGothic-Regular.ttf';
const KOREAN_FONT_URL = '/fonts/NanumGothic-Regular.ttf';
let koreanFontBase64: string | null = null;

async function loadKoreanFontBase64(): Promise<string> {
  if (koreanFontBase64) return koreanFontBase64;
  const buf = await fetch(KOREAN_FONT_URL).then((r) => {
    if (!r.ok) throw new Error(`font fetch ${r.status}`);
    return r.arrayBuffer();
  });
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000; // 큰 배열 spread 시 스택 오버플로 방지
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  koreanFontBase64 = btoa(binary);
  return koreanFontBase64;
}

// PDF 에 한글 폰트를 등록·적용. 실패 시(폰트 로드 불가) 기본 폰트로 폴백.
async function applyKoreanFont(pdf: jsPDF): Promise<void> {
  try {
    const b64 = await loadKoreanFontBase64();
    pdf.addFileToVFS(KOREAN_FONT_FILE, b64);
    pdf.addFont(KOREAN_FONT_FILE, KOREAN_FONT_NAME, 'normal');
    pdf.setFont(KOREAN_FONT_NAME);
  } catch {
    /* 폰트 로드 실패 시 기본 폰트 유지(영문은 정상) */
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// 실제 PDF 파일 생성·다운로드. (한글 폰트 embed 위해 async)
export async function downloadPdf(title: string, content: unknown): Promise<void> {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  await applyKoreanFont(pdf); // 한글 폰트 적용(폰트 로드 후 splitTextToSize 폭 계산이 정확해짐)
  const margin = 48;
  const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = pdf.internal.pageSize.getHeight() - margin;
  let y = margin;

  pdf.setFontSize(18);
  for (const line of pdf.splitTextToSize(title, maxWidth) as string[]) {
    pdf.text(line, margin, y);
    y += 24;
  }
  y += 8;
  pdf.setFontSize(11);
  for (const raw of contentToLines(content)) {
    for (const line of pdf.splitTextToSize(raw || ' ', maxWidth) as string[]) {
      if (y > pageHeight) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 16;
    }
  }
  pdf.save(`${safeFileName(title)}.pdf`);
}

// 실제 Word(.docx) 파일 생성·다운로드.
export async function downloadDocx(title: string, content: unknown): Promise<void> {
  const paragraphs = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
    ...contentToLines(content).map(
      (line) => new Paragraph({ children: [new TextRun(line)] }),
    ),
  ];
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${safeFileName(title)}.docx`);
}
