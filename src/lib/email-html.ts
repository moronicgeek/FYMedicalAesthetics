// Branded HTML version of a plain-text email. The text stays the source of
// truth (and is sent alongside), so every email gets the same look without
// each caller writing HTML. Email clients ignore <style> blocks and CSS
// variables unevenly, so the theme colours are inlined here.

export const EMAIL_LOGO_CID = "lumiere-logo";

const COLOR = {
  canvas: "#efeeec",
  surface: "#ffffff",
  line: "#d6d3cf",
  accent: "#a46a5e",
  ink: "#1c1c1c",
};

// Gmail and Outlook don't load web fonts, so Verdana is the wide, legible fallback.
const FONT = `'Atkinson Hyperlegible', Verdana, Arial, sans-serif`;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function paragraph(block: string) {
  const html = block
    .split("\n")
    .map((line) => escapeHtml(line).replace(/ {2}/g, " &nbsp;"))
    .join("<br>");
  return `<p style="margin:0 0 18px;font-family:${FONT};font-size:17px;line-height:1.6;color:${COLOR.ink};">${html}</p>`;
}

export function emailHtml(text: string, clinicName: string) {
  const body = text.trim().split(/\n{2,}/).map(paragraph).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap" rel="stylesheet">
<title>${escapeHtml(clinicName)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.canvas};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.canvas};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${COLOR.surface};border:1px solid ${COLOR.line};border-radius:4px;">
<tr><td align="center" style="padding:28px 32px 22px;border-bottom:2px solid ${COLOR.accent};">
<img src="cid:${EMAIL_LOGO_CID}" width="200" alt="${escapeHtml(clinicName)}" style="display:block;width:200px;max-width:100%;height:auto;border:0;">
</td></tr>
<tr><td style="padding:28px 32px 10px;">${body}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
