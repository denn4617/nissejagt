// netlify/functions/send-giftcard.js
import fs from "node:fs/promises";
import path from "node:path";

export async function handler(event) {
  // CORS (så din frontend kan kalde funktionen)
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { email } = JSON.parse(event.body || "{}");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invalid email" }) };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const MAIL_FROM = process.env.MAIL_FROM || "Nisse <onboarding@resend.dev>";
    const subject = process.env.GIFT_SUBJECT || "Din sidste gave 🎁";
    const filename = process.env.GIFT_FILENAME || "gavekort.pdf";

    if (!RESEND_API_KEY) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Missing RESEND_API_KEY" }) };
    }

    // Læs din gavekort-fil fra repoet
    const filePath = path.join(process.cwd(), "giftcard.pdf");
    const fileBuffer = await fs.readFile(filePath);
    const base64 = Buffer.from(fileBuffer).toString("base64");

    // Send via Resend API
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [email],
        subject,
        html: `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;">
            <h2>🎁 Din sidste gave</h2>
            <p>Sådan! Vedhæftet finder du gavekortet.</p>
            <p>Glædelig jul 🎄</p>
          </div>
        `,
        attachments: [
          {
            filename,
            content: base64, // Base64-encoded content
          },
        ],
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { statusCode: res.status, headers: cors, body: JSON.stringify({ error: data?.message || "Resend error", data }) };
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, id: data.id }) };
  } catch (err) {
  console.error("send-giftcard failed:", err);
  return {
    statusCode: 500,
    headers: cors,
    body: JSON.stringify({ error: "Server error", details: String(err?.message || err) }),
  };
}
}