import { describe, expect, it } from "vitest";
import { EMAIL_LOGO_CID, emailHtml } from "../src/lib/email-html";

describe("branded email", () => {
  it("turns blank-line blocks into paragraphs and line breaks into <br>", () => {
    const html = emailHtml("Hello Thandi,\n\nSee you soon.\n\nLumiere Clinic\nJohannesburg", "Lumiere Clinic");
    expect(html.match(/<p /g)).toHaveLength(3);
    expect(html).toContain("Lumiere Clinic<br>Johannesburg");
  });

  it("escapes names and other text", () => {
    const html = emailHtml("Hello <b>O'Brien</b> & co", "Lumiere Clinic");
    expect(html).toContain("Hello &lt;b&gt;O&#39;Brien&lt;/b&gt; &amp; co");
    expect(html).not.toContain("<b>");
  });

  it("shows the embedded logo", () => {
    expect(emailHtml("Hi", "Lumiere Clinic")).toContain(`src="cid:${EMAIL_LOGO_CID}"`);
  });
});
