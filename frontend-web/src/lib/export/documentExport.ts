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

// 실제 PDF 파일 생성·다운로드.
export function downloadPdf(title: string, content: unknown): void {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
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
