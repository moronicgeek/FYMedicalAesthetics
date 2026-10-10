import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { CLINIC_LINE, CONSENT_FORMS } from "./consent-forms";
import type { ConsentRecord } from "./cases";
import { LOGO_PNG_BASE64 } from "./logo-png";
import { formatDateTime } from "./time";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const WIDTH = A4[0] - MARGIN * 2;
const FOOTER = 40;
// The Stone & Charcoal theme of the app.
const CHARCOAL = rgb(0.17, 0.17, 0.17);
const INK = rgb(0.11, 0.11, 0.1);
const MUTED = rgb(0.38, 0.36, 0.34);
const STONE = rgb(0.937, 0.933, 0.925);
const LINE = rgb(0.8, 0.79, 0.77);
const WHITE = rgb(1, 1, 1);

// Standard PDF fonts only cover Windows-1252; swap anything else for a safe
// equivalent so a stray emoji or smart symbol can't break the document.
function safe(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ•]/g, "?");
}

function wrap(raw: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const para of safe(raw).split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/)) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

type Fonts = { regular: PDFFont; bold: PDFFont };

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private f: Fonts, private logo: PDFImage, private reference: string) {
    this.firstPage();
  }

  private firstPage() {
    this.page = this.doc.addPage(A4);
    const top = A4[1] - MARGIN;
    const h = 58;
    const w = (this.logo.width / this.logo.height) * h;
    this.page.drawImage(this.logo, { x: MARGIN, y: top - h, width: w, height: h });
    const tx = MARGIN + w + 14;
    this.draw("FY MEDICAL AESTHETICS", tx, top - 24, 15, true, CHARCOAL);
    this.draw(CLINIC_LINE, tx, top - 40, 9, false, MUTED);
    this.drawRight("SIGNED CONSENT FORM", top - 22, 8, true, MUTED);
    this.drawRight(`Reference #${this.reference}`, top - 37, 10, true, INK);
    this.y = top - h - 14;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness: 1.5, color: CHARCOAL });
    this.y -= 22;
  }

  private nextPage() {
    this.page = this.doc.addPage(A4);
    const top = A4[1] - MARGIN;
    const h = 26;
    const w = (this.logo.width / this.logo.height) * h;
    this.page.drawImage(this.logo, { x: MARGIN, y: top - h, width: w, height: h });
    this.draw("FY MEDICAL AESTHETICS", MARGIN + w + 10, top - 17, 10, true, CHARCOAL);
    this.drawRight(`Reference #${this.reference}`, top - 17, 9, false, MUTED);
    this.y = top - h - 10;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness: 0.75, color: CHARCOAL });
    this.y -= 20;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN + FOOTER) this.nextPage();
  }

  draw(text: string, x: number, y: number, size: number, bold = false, color = INK, page = this.page) {
    page.drawText(safe(text), { x, y, size, font: bold ? this.f.bold : this.f.regular, color });
  }

  drawRight(text: string, y: number, size: number, bold = false, color = INK, page = this.page) {
    const width = (bold ? this.f.bold : this.f.regular).widthOfTextAtSize(safe(text), size);
    this.draw(text, A4[0] - MARGIN - width, y, size, bold, color, page);
  }

  // A run of wrapped text, breaking across pages as needed.
  paragraph(text: string, { size = 9.5, bold = false, color = INK, indent = 0, after = 6 } = {}) {
    const lead = size * 1.4;
    for (const line of wrap(text, bold ? this.f.bold : this.f.regular, size, WIDTH - indent)) {
      this.ensure(lead);
      this.draw(line, MARGIN + indent, this.y - size, size, bold, color);
      this.y -= lead;
    }
    this.y -= after;
  }

  bullet(text: string) {
    const size = 9.5;
    const lead = size * 1.4;
    const lines = wrap(text, this.f.regular, size, WIDTH - 16);
    lines.forEach((line, i) => {
      this.ensure(lead);
      if (i === 0) this.page.drawCircle({ x: MARGIN + 5, y: this.y - size + 3, size: 1.6, color: CHARCOAL });
      this.draw(line, MARGIN + 16, this.y - size, size);
      this.y -= lead;
    });
    this.y -= 2;
  }

  // Spaced capitals over a thin rule, kept with the first lines below it.
  heading(text: string) {
    this.ensure(60);
    this.y -= 6;
    this.draw(text.toUpperCase().split("").join(" ").replace(/ {3}/g, "   "), MARGIN, this.y - 9, 8.5, true, CHARCOAL);
    this.y -= 15;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness: 0.5, color: LINE });
    this.y -= 12;
  }

  subheading(text: string) {
    this.ensure(40);
    this.paragraph(text, { size: 10.5, bold: true, after: 3 });
  }

  // Label/value pairs in two columns on a stone panel.
  details(pairs: [string, string][]) {
    const pad = 14;
    const gap = 20;
    const col = (WIDTH - pad * 2 - gap) / 2;
    const rows: { cells: { label: string; lines: string[] }[]; height: number }[] = [];
    for (let i = 0; i < pairs.length; i += 2) {
      const cells = pairs.slice(i, i + 2).map(([label, value]) => ({ label, lines: wrap(value || "-", this.f.regular, 10.5, col) }));
      rows.push({ cells, height: 14 + Math.max(...cells.map((c) => c.lines.length)) * 14 + 8 });
    }
    const total = rows.reduce((s, r) => s + r.height, 0) + pad * 2 - 8;
    this.ensure(total);
    this.page.drawRectangle({ x: MARGIN, y: this.y - total, width: WIDTH, height: total, color: STONE });
    let y = this.y - pad;
    for (const r of rows) {
      r.cells.forEach((c, i) => {
        const x = MARGIN + pad + i * (col + gap);
        this.draw(c.label.toUpperCase(), x, y - 7, 7, true, MUTED);
        c.lines.forEach((l, j) => this.draw(l, x, y - 22 - j * 14, 10.5));
      });
      y -= r.height;
    }
    this.y -= total + 14;
  }

  // Medical history questions with the answer in its own column.
  answers(rows: { text: string; yes: boolean }[]) {
    const answerCol = 56;
    const size = 9.5;
    rows.forEach((r, i) => {
      const lines = wrap(r.text, this.f.regular, size, WIDTH - answerCol - 20);
      const h = lines.length * 13.5 + 10;
      this.ensure(h);
      if (i % 2 === 0) this.page.drawRectangle({ x: MARGIN, y: this.y - h, width: WIDTH, height: h, color: STONE });
      lines.forEach((l, j) => this.draw(l, MARGIN + 10, this.y - 15 - j * 13.5, size));
      const bx = A4[0] - MARGIN - answerCol;
      if (r.yes) {
        this.page.drawRectangle({ x: bx + 6, y: this.y - 19, width: answerCol - 16, height: 15, color: CHARCOAL });
        this.draw("YES", bx + 6 + (answerCol - 16 - this.f.bold.widthOfTextAtSize("YES", 8.5)) / 2, this.y - 15, 8.5, true, WHITE);
      } else {
        this.draw("No", bx + 6 + (answerCol - 16 - this.f.regular.widthOfTextAtSize("No", 9.5)) / 2, this.y - 15, 9.5, false, MUTED);
      }
      this.y -= h;
    });
    this.y -= 10;
  }

  // A ticked box beside each statement the client confirmed.
  ticked(text: string) {
    const size = 9.5;
    const lines = wrap(text, this.f.regular, size, WIDTH - 22);
    this.ensure(lines.length * 13.5 + 4);
    const by = this.y - 11;
    this.page.drawRectangle({ x: MARGIN, y: by, width: 10, height: 10, borderColor: CHARCOAL, borderWidth: 0.8 });
    this.page.drawLine({ start: { x: MARGIN + 2, y: by + 5 }, end: { x: MARGIN + 4.2, y: by + 2.4 }, thickness: 1.2, color: CHARCOAL });
    this.page.drawLine({ start: { x: MARGIN + 4.2, y: by + 2.4 }, end: { x: MARGIN + 8.4, y: by + 8 }, thickness: 1.2, color: CHARCOAL });
    lines.forEach((l, j) => this.draw(l, MARGIN + 22, this.y - 10 - j * 13.5, size));
    this.y -= lines.length * 13.5 + 6;
  }

  // The signature in a framed box with who signed and when beside it.
  signature(img: PDFImage, signedName: string, signedAt: string) {
    const boxW = 250;
    const boxH = 90;
    this.ensure(boxH + 30);
    const top = this.y;
    this.page.drawRectangle({ x: MARGIN, y: top - boxH, width: boxW, height: boxH, borderColor: LINE, borderWidth: 0.75 });
    const scale = Math.min((boxW - 20) / img.width, (boxH - 16) / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    this.page.drawImage(img, { x: MARGIN + (boxW - w) / 2, y: top - boxH + (boxH - h) / 2, width: w, height: h });
    this.draw("CLIENT SIGNATURE", MARGIN, top - boxH - 13, 7, true, MUTED);
    const x = MARGIN + boxW + 24;
    this.draw("SIGNED BY", x, top - 10, 7, true, MUTED);
    this.draw(signedName, x, top - 25, 11, true);
    this.draw("DATE AND TIME", x, top - 48, 7, true, MUTED);
    this.draw(signedAt, x, top - 63, 10.5);
    this.y = top - boxH - 30;
  }

  // A shaded note, such as the post-care advice.
  note(title: string, text: string) {
    const pad = 12;
    const lines = wrap(text, this.f.regular, 9.5, WIDTH - pad * 2);
    const h = pad * 2 + 16 + lines.length * 13.5;
    this.ensure(h);
    this.page.drawRectangle({ x: MARGIN, y: this.y - h, width: WIDTH, height: h, color: STONE });
    this.page.drawRectangle({ x: MARGIN, y: this.y - h, width: 3, height: h, color: CHARCOAL });
    this.draw(title, MARGIN + pad, this.y - pad - 9, 10, true);
    lines.forEach((l, j) => this.draw(l, MARGIN + pad, this.y - pad - 26 - j * 13.5, 9.5));
    this.y -= h + 12;
  }

  footers() {
    const pages = this.doc.getPages();
    pages.forEach((page, i) => {
      page.drawLine({ start: { x: MARGIN, y: MARGIN + 14 }, end: { x: A4[0] - MARGIN, y: MARGIN + 14 }, thickness: 0.5, color: LINE });
      this.draw(`FY Medical Aesthetics | ${CLINIC_LINE}`, MARGIN, MARGIN, 7.5, false, MUTED, page);
      this.drawRight(`Page ${i + 1} of ${pages.length}`, MARGIN, 7.5, false, MUTED, page);
    });
  }
}

export async function buildConsentPdf(consent: ConsentRecord, caseCode: string): Promise<Buffer> {
  const form = CONSENT_FORMS[consent.formType];
  const doc = await PDFDocument.create();
  const p = consent.patient;
  const fullName = `${p.firstName} ${p.lastName}`;
  const signedAt = formatDateTime(new Date(consent.signedAt));
  doc.setTitle(`${form.title} - ${fullName}`);
  doc.setAuthor("FY Medical Aesthetics");
  const fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));
  const signature = await doc.embedPng(Buffer.from(consent.signature.split(",")[1] ?? "", "base64"));
  const w = new Writer(doc, fonts, logo, caseCode);

  w.paragraph(form.title, { size: 15, bold: true, after: 2 });
  if (form.subtitle) w.paragraph(form.subtitle, { size: 10, color: MUTED, after: 2 });
  w.paragraph(`Form version ${consent.formVersion}`, { size: 8, color: MUTED, after: 14 });

  w.heading("Client details");
  w.details([
    ["Full name", fullName],
    ["Date of birth", p.dateOfBirth],
    ["ID number", p.idNumber || "-"],
    ["Contact number", p.phone],
    ["Email", p.email],
    [form.treatmentChoice?.label ?? "Treatment", consent.treatment || (form.type === "IV_DRIP" ? "-" : "To be chosen by the doctor")],
    ["Emergency contact", [consent.emergency.name, consent.emergency.phone].filter(Boolean).join(", ") || "-"],
    ["Date signed", signedAt],
  ]);

  w.heading("About the treatment");
  for (const s of form.sections) {
    w.subheading(s.heading);
    for (const para of s.paragraphs ?? []) w.paragraph(para);
    for (const b of s.bullets ?? []) w.bullet(b);
    w.y -= 6;
  }

  w.heading("Medical history");
  w.answers(form.questions.map((q) => ({ text: q.text, yes: consent.answers[q.id] === "yes" })));
  for (const d of form.detailFields) {
    w.paragraph(d.label, { size: 8.5, bold: true, color: MUTED, after: 1 });
    w.paragraph(consent.details[d.id] || "-", { after: 8 });
  }

  w.heading("Client acknowledgement");
  for (const a of form.acknowledgements) w.ticked(a);
  w.y -= 4;

  // The consent wording and the signature stay on one page.
  const statement = form.consentStatement?.(fullName);
  w.ensure(60 + (statement ? wrap(statement, fonts.regular, 9.5, WIDTH).length * 13.3 + 12 : 0) + 120);
  w.heading("Consent");
  if (statement) w.paragraph(statement, { after: 12 });
  w.signature(signature, consent.signedName, signedAt);

  if (form.postCare) w.note("Post-care advice", form.postCare);

  w.footers();
  return Buffer.from(await doc.save());
}
