import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CLINIC_LINE, CONSENT_FORMS } from "./consent-forms";
import type { ConsentRecord } from "./cases";
import { formatDateTime } from "./time";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const BRAND = rgb(0.03, 0.29, 0.31);
const INK = rgb(0.07, 0.15, 0.16);
const MUTED = rgb(0.27, 0.35, 0.36);

// Standard PDF fonts only cover Windows-1252; swap anything else for a safe
// equivalent so a stray emoji or smart symbol can't break the document.
function safe(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF\u2022]/g, "?");
}

class Writer {
  page: PDFPage;
  y: number;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont) {
    this.page = doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }
  ensure(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage(A4);
      this.y = A4[1] - MARGIN;
    }
  }
  text(raw: string, { size = 10, bold = false, color = INK, indent = 0, gap = 4 } = {}) {
    const font = bold ? this.bold : this.font;
    const width = A4[0] - MARGIN * 2 - indent;
    for (const para of safe(raw).split("\n")) {
      const words = para.split(/\s+/);
      let line = "";
      const lines: string[] = [];
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(next, size) > width && line) {
          lines.push(line);
          line = w;
        } else line = next;
      }
      lines.push(line);
      for (const l of lines) {
        this.ensure(size + 3);
        this.page.drawText(l, { x: MARGIN + indent, y: this.y - size, size, font, color });
        this.y -= size + 3;
      }
    }
    this.y -= gap;
  }
  rule() {
    this.ensure(10);
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness: 0.5, color: MUTED });
    this.y -= 10;
  }
  async image(dataUrl: string, maxWidth = 220, maxHeight = 80) {
    const bytes = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
    const img = await this.doc.embedPng(bytes);
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    this.ensure(h + 6);
    this.page.drawImage(img, { x: MARGIN, y: this.y - h, width: w, height: h });
    this.y -= h + 6;
  }
}

export async function buildConsentPdf(consent: ConsentRecord, caseCode: string): Promise<Buffer> {
  const form = CONSENT_FORMS[consent.formType];
  const doc = await PDFDocument.create();
  doc.setTitle(`${form.title} - ${consent.patient.firstName} ${consent.patient.lastName}`);
  doc.setAuthor("FY Medical Aesthetics");
  const w = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));
  const p = consent.patient;
  const fullName = `${p.firstName} ${p.lastName}`;

  w.text("FY MEDICAL AESTHETICS", { size: 16, bold: true, color: BRAND, gap: 0 });
  w.text(CLINIC_LINE, { size: 9, color: MUTED });
  w.text(form.title.toUpperCase(), { size: 12, bold: true, gap: 0 });
  if (form.subtitle) w.text(form.subtitle, { size: 10, color: MUTED });
  w.text(`Reference #${caseCode} · Form version ${consent.formVersion}`, { size: 8, color: MUTED });
  w.rule();

  w.text("Patient details", { bold: true, size: 11 });
  w.text(`Full name: ${fullName}`);
  w.text(`Date of birth: ${p.dateOfBirth}    ID number: ${p.idNumber || "-"}`);
  w.text(`Contact no: ${p.phone}    Email: ${p.email}`);
  w.text(`Date: ${formatDateTime(new Date(consent.signedAt))}`);
  if (consent.treatment) w.text(`${form.treatmentChoice?.label ?? "Treatment"}: ${consent.treatment}`);
  w.rule();

  for (const s of form.sections) {
    w.text(s.heading, { bold: true, size: 11 });
    for (const para of s.paragraphs ?? []) w.text(para);
    for (const b of s.bullets ?? []) w.text(`•  ${b}`, { indent: 10, gap: 1 });
    w.y -= 4;
  }

  w.text("Medical history", { bold: true, size: 11 });
  for (const q of form.questions) w.text(`${consent.answers[q.id] === "yes" ? "YES" : "NO "}   ${q.text}`, { gap: 1 });
  w.y -= 4;
  for (const d of form.detailFields) w.text(`${d.label}: ${consent.details[d.id] || "-"}`);

  w.text("Patient acknowledgement", { bold: true, size: 11 });
  for (const a of form.acknowledgements) w.text(`[x]  ${a}`, { indent: 0, gap: 2 });
  w.y -= 4;

  w.text("Consent", { bold: true, size: 11 });
  if (form.consentStatement) w.text(form.consentStatement(fullName));
  w.text(`Signed by ${consent.signedName} on ${formatDateTime(new Date(consent.signedAt))}`, { color: MUTED, size: 9 });
  await w.image(consent.signature);
  w.text(`Emergency contact: ${consent.emergency.name || "-"}    No: ${consent.emergency.phone || "-"}`);
  if (form.postCare) {
    w.rule();
    w.text(`Post-care advice: ${form.postCare}`);
  }
  w.rule();
  w.text("FY Medical Aesthetics, Robertsham, Johannesburg | Managed by Lumiere Clinic", { size: 8, color: MUTED });

  return Buffer.from(await doc.save());
}
