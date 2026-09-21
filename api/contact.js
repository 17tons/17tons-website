// Vercel Node function behind the contact dialog.
//
// Mail leaves through the same SMTP account metatons-core already sends with; the credentials are
// project environment variables and are never read or logged anywhere else.

import nodemailer from "nodemailer";
import { createContactHandler } from "../server/contact/message.js";

let transport;

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }

  return transport;
}

async function sendMail(mail) {
  await getTransport().sendMail(mail);
}

async function verifyCaptcha(token, ip, action) {
  const body = new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET, response: token });
  if (ip) body.set("remoteip", ip);

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", { method: "POST", body });
  if (!response.ok) throw new Error(`reCAPTCHA verification responded with ${response.status}`);

  const verdict = await response.json();

  return {
    // The action ties the token to this form, so a token minted elsewhere cannot be replayed here.
    success: verdict.success === true && verdict.action === action,
    score: Number(verdict.score ?? 0),
  };
}

export default createContactHandler({ env: process.env, sendMail, verifyCaptcha });
