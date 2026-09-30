// Contact-form logic behind the AWS Lambda in server/contact/aws-lambda.js.
//
// The mail transport and the captcha service are injected, so this module performs no network
// access of its own and the Lambda entry stays a thin wrapper around it.

export const contactLimits = Object.freeze({ name: 200, email: 254, message: 5000 });
export const contactLocales = Object.freeze(["en", "it"]);
export const contactBodyLimit = 20 * 1024;
export const contactRequiredEnv = Object.freeze(["CONTACT_SENDER_EMAIL", "CONTACT_RECIPIENT", "RECAPTCHA_SECRET"]);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Localized on purpose: this is the subject line the recipient reads, not an internal label.
const subjects = {
  en: (name) => `Website contact request — ${name}`,
  it: (name) => `Richiesta di contatto dal sito — ${name}`,
};

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Anything that reaches a mail header must not be able to end the header early, so every control
// character is dropped before the value is used.
function headerValue(value) {
  const flattened = [...String(value)].map((character) => {
    const code = character.codePointAt(0);
    return code > 31 && code !== 127 ? character : " ";
  });

  return flattened.join("").replace(/\s+/g, " ").trim();
}

// A display name sits inside a quoted string, so the two characters that could end it early are
// escaped as well.
function displayName(value) {
  return headerValue(value).replace(/["\\]/g, "\\$&");
}

function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function requestHost(req) {
  const headers = req.headers ?? {};
  const host = headers["x-forwarded-host"] ?? headers.host ?? "";
  return String(host).split(",")[0].trim().toLowerCase();
}

// Browsers send Origin on every POST, same-origin included, so a mismatch is always a foreign page.
// A request without the header is not a browser submission; the captcha still applies to it.
// Behind a proxy the request host is the function's own, so the site's hosts are listed instead.
function isSameOrigin(req, allowedHosts) {
  const origin = req.headers?.origin;
  if (!origin) return true;

  let host;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }

  if (allowedHosts.length > 0) return allowedHosts.includes(host);

  const expected = requestHost(req);
  return expected.length > 0 && host === expected;
}

function clientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "";
}

async function readPayload(req) {
  const declared = Number(req.headers?.["content-length"] ?? 0);
  if (Number.isFinite(declared) && declared > contactBodyLimit) return { kind: "too_large" };

  const body = req.body;

  if (body !== undefined && body !== null) {
    // Some runtimes parse a JSON request body before the handler runs.
    if (typeof body === "object") return { kind: "ok", value: body };
    if (typeof body !== "string") return { kind: "invalid" };
    if (body.length > contactBodyLimit) return { kind: "too_large" };

    try {
      return { kind: "ok", value: JSON.parse(body) };
    } catch {
      return { kind: "invalid" };
    }
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > contactBodyLimit) return { kind: "too_large" };
    chunks.push(chunk);
  }

  if (size === 0) return { kind: "invalid" };

  try {
    return { kind: "ok", value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { kind: "invalid" };
  }
}

export function isHoneypotFilled(payload) {
  return text(payload?.website).length > 0;
}

export function validateSubmission(payload) {
  const name = text(payload?.name);
  const email = text(payload?.email);
  const message = text(payload?.message);
  const locale = contactLocales.includes(payload?.locale) ? payload.locale : "en";

  if (name.length === 0 || name.length > contactLimits.name) return { ok: false, code: "invalid_name" };
  if (email.length === 0 || email.length > contactLimits.email || !emailPattern.test(email)) {
    return { ok: false, code: "invalid_email" };
  }
  if (message.length === 0 || message.length > contactLimits.message) {
    return { ok: false, code: "invalid_message" };
  }

  return { ok: true, value: { name, email, message, locale } };
}

export function buildMail(submission, config) {
  const send = subjects[submission.locale] ?? subjects.en;
  const from = config.fromName
    ? `"${displayName(config.fromName)}" <${config.fromAddress}>`
    : config.fromAddress;

  return {
    from,
    to: config.recipient,
    replyTo: headerValue(submission.email),
    subject: send(headerValue(submission.name)),
    // Plain text only: the submitter's own words are never interpolated into markup.
    text: [
      "Website contact request.",
      "",
      `Name: ${submission.name}`,
      `E-mail: ${submission.email}`,
      `Language: ${submission.locale}`,
      "",
      "Message:",
      submission.message,
    ].join("\n"),
  };
}

export function createContactHandler({ env, sendMail, verifyCaptcha, allowedHosts = [], logger = console }) {
  return async function contactHandler(req, res) {
    if (req.method !== "POST") return respond(res, 405, { ok: false, code: "method_not_allowed" });
    if (!isSameOrigin(req, allowedHosts)) return respond(res, 403, { ok: false, code: "forbidden_origin" });

    const missing = contactRequiredEnv.filter((name) => !env[name]);
    if (missing.length > 0) {
      logger.error(`contact form is not configured: missing ${missing.join(", ")}`);
      return respond(res, 500, { ok: false, code: "not_configured" });
    }

    const payload = await readPayload(req);
    if (payload.kind === "too_large") return respond(res, 413, { ok: false, code: "payload_too_large" });
    if (payload.kind !== "ok") return respond(res, 400, { ok: false, code: "invalid_payload" });

    // A filled honeypot is answered exactly like a delivered message, so a bot learns nothing.
    if (isHoneypotFilled(payload.value)) return respond(res, 200, { ok: true });

    const validation = validateSubmission(payload.value);
    if (!validation.ok) return respond(res, 400, { ok: false, code: validation.code });

    const token = text(payload.value.recaptchaToken);
    if (token.length === 0) return respond(res, 400, { ok: false, code: "recaptcha_failed" });

    let verdict;
    try {
      verdict = await verifyCaptcha(token, clientIp(req), "contact");
    } catch (error) {
      logger.error("contact form could not verify the reCAPTCHA token:", error?.message ?? error);
      return respond(res, 502, { ok: false, code: "recaptcha_unavailable" });
    }

    const minimum = Number(env.RECAPTCHA_MIN_SCORE ?? 0.5);
    if (verdict?.success !== true || !Number.isFinite(verdict.score) || verdict.score < minimum) {
      return respond(res, 400, { ok: false, code: "recaptcha_failed" });
    }

    const config = {
      recipient: env.CONTACT_RECIPIENT,
      fromName: env.CONTACT_SENDER_NAME ?? "",
      fromAddress: env.CONTACT_SENDER_EMAIL,
    };

    try {
      await sendMail(buildMail(validation.value, config));
    } catch (error) {
      logger.error("contact form could not send the message:", error?.message ?? error);
      return respond(res, 502, { ok: false, code: "send_failed" });
    }

    return respond(res, 200, { ok: true });
  };
}
