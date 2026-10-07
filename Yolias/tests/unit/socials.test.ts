import { test } from "node:test";
import assert from "node:assert/strict";
import { socialsFromHtml } from "../../lib/intel/socials.ts";
import { conversationUrl, whatsappDigits } from "../../lib/outreach/channels.ts";

test("a website's own social links are read; share buttons and posts are not", () => {
  const html = `
    <a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>
    <a href="https://www.instagram.com/p/Cx12/">post</a>
    <a href="https://m.facebook.com/AcmeBakery/">Facebook</a>
    <a href='https://instagram.com/acme.bakery?igsh=1'>Instagram</a>
    <a href="https://api.whatsapp.com/send?phone=+20 100 123 4567&amp;text=hi">WhatsApp</a>`;
  assert.deepEqual(socialsFromHtml(html, "https://acme.example/"), {
    facebookUrl: "https://www.facebook.com/AcmeBakery",
    instagramUrl: "https://www.instagram.com/acme.bakery",
    whatsapp: "201001234567",
    email: null,
    phone: null,
  });
});

test("wa.me links and numeric Facebook profiles are understood; nothing is guessed", () => {
  assert.deepEqual(socialsFromHtml(`<a href="https://wa.me/966500000001">chat</a><a href="https://www.facebook.com/profile.php?id=1000123">fb</a>`, "https://x.example"), {
    facebookUrl: "https://www.facebook.com/profile.php?id=1000123", instagramUrl: null, whatsapp: "966500000001", email: null, phone: null,
  });
  assert.deepEqual(socialsFromHtml(`<p>Call +20 100 000 0000</p><a href="/contact">Contact</a>`, "https://x.example"), { facebookUrl: null, instagramUrl: null, whatsapp: null, email: null, phone: null });
});

test("the site's own public inbox and phone are read (D-163); placeholders are not", () => {
  const html = `
    <a href="mailto:noreply@acme.example">x</a>
    <a href="mailto:Ahmed@acme.example?subject=hi">Ahmed</a>
    <a href="mailto:info@acme.example">Email us</a>
    <a href="mailto:user@domain.com">template</a>
    <a href="tel:+20 2 1234 5678">Call</a>`;
  const s = socialsFromHtml(html, "https://acme.example");
  assert.equal(s.email, "info@acme.example");
  assert.equal(s.phone, "+20212345678");
  assert.equal(socialsFromHtml(`<a href="mailto:ahmed@acme.example">a</a>`, "https://acme.example").email, "ahmed@acme.example");
  assert.equal(socialsFromHtml(`<p>info@acme.example</p><a href="mailto:test@acme.example">t</a>`, "https://acme.example").email, null);
});

test("conversation links open the member's own app", () => {
  assert.equal(whatsappDigits("+20 (100) 123-4567"), "201001234567");
  assert.equal(whatsappDigits("12"), null);
  assert.equal(conversationUrl("whatsapp", { whatsapp: "+20 100 123 4567" }, "Hi Sara"), "https://wa.me/201001234567?text=Hi%20Sara");
  assert.equal(conversationUrl("facebook", { facebookUrl: "https://www.facebook.com/AcmeBakery" }, "x"), "https://m.me/AcmeBakery");
  assert.equal(conversationUrl("instagram", { instagramUrl: "https://www.instagram.com/acme.bakery" }, "x"), "https://ig.me/m/acme.bakery");
  assert.equal(conversationUrl("whatsapp", { whatsapp: null }, "x"), null);
});
