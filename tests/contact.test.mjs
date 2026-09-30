import assert from "node:assert/strict";
import test from "node:test";
import { buildMail, contactBodyLimit, createContactHandler, validateSubmission } from "../server/contact/message.js";

const newline = String.fromCharCode(13, 10);
const env = {
  SMTP_HOST: "smtp.private.example",
  SMTP_USER: "sender-user",
  SMTP_PASSWORD: "smtp-password-value",
  SMTP_SENDER_NAME: "Sito 17tons",
  SMTP_SENDER_EMAIL: "no-reply@17tons.earth",
  CONTACT_RECIPIENT: "info@17tons.earth",
  RECAPTCHA_SECRET: "captcha-secret-value",
};

const secrets = [env.SMTP_HOST, env.SMTP_USER, env.SMTP_PASSWORD, env.RECAPTCHA_SECRET];

const submission = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "We would like to monitor a reforestation project.",
  website: "",
  locale: "it",
  recaptchaToken: "captcha-token",
};

function makeRequest({ method = "POST", body, stream, headers = {} } = {}) {
  const request = { method, headers: { host: "17tons-website.vercel.app", ...headers } };

  if (body !== undefined) request.body = body;
  if (stream !== undefined) {
    request[Symbol.asyncIterator] = async function* iterate() {
      yield Buffer.from(stream);
    };
  }

  return request;
}

function makeResponse() {
  return {
    statusCode: 0,
    headers: {},
    payload: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk) {
      this.payload = chunk ?? "";
    },
    json() {
      return JSON.parse(this.payload);
    },
  };
}

function harness({ verifyCaptcha, sendMail, environment = env } = {}) {
  const calls = { sent: [], verified: [] };

  const handler = createContactHandler({
    env: environment,
    logger: { error() {} },
    verifyCaptcha: verifyCaptcha ?? (async (token, ip, action) => {
      calls.verified.push({ token, ip, action });
      return { success: true, score: 0.9 };
    }),
    sendMail: sendMail ?? (async (mail) => {
      calls.sent.push(mail);
    }),
  });

  return { handler, calls };
}

async function submit(handler, request = makeRequest({ body: submission })) {
  const response = makeResponse();
  await handler(request, response);
  return response;
}

test("a valid submission reaches the recipient with a reply-to address", async () => {
  const { handler, calls } = harness();
  const response = await submit(handler);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
  assert.equal(calls.sent.length, 1);

  const [mail] = calls.sent;
  assert.equal(mail.to, env.CONTACT_RECIPIENT);
  assert.equal(mail.replyTo, submission.email);
  assert.equal(mail.from, `"Sito 17tons" <${env.SMTP_SENDER_EMAIL}>`);
  assert.equal(mail.html, undefined, "the body must stay plain text");
  assert.match(mail.subject, /Richiesta di contatto dal sito/);
  assert.match(mail.text, /Ada Lovelace/);
  assert.match(mail.text, /ada@example\.com/);
  assert.match(mail.text, /reforestation project/);
  assert.equal(calls.verified[0].action, "contact");
  assert.equal(calls.verified[0].token, submission.recaptchaToken);
});

test("the English locale chooses the English subject line", async () => {
  const { handler, calls } = harness();
  await submit(handler, makeRequest({ body: { ...submission, locale: "en" } }));

  assert.match(calls.sent[0].subject, /^Website contact request/);
});

test("a filled honeypot is answered like a delivered message and sends nothing", async () => {
  const { handler, calls } = harness();
  const response = await submit(handler, makeRequest({ body: { ...submission, website: "https://spam.example" } }));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
  assert.equal(calls.sent.length, 0);
  assert.equal(calls.verified.length, 0, "a bot must not even reach the captcha");
});

test("every invalid field is refused with its own code and nothing is sent", async () => {
  const cases = [
    [{ name: "" }, "invalid_name"],
    [{ name: "x".repeat(201) }, "invalid_name"],
    [{ email: "not-an-address" }, "invalid_email"],
    [{ email: `${"x".repeat(250)}@example.com` }, "invalid_email"],
    [{ message: "" }, "invalid_message"],
    [{ message: "x".repeat(5001) }, "invalid_message"],
  ];

  for (const [patch, code] of cases) {
    const { handler, calls } = harness();
    const response = await submit(handler, makeRequest({ body: { ...submission, ...patch } }));

    assert.equal(response.statusCode, 400, `${code} should be refused`);
    assert.deepEqual(response.json(), { ok: false, code });
    assert.equal(calls.sent.length, 0);
  }
});

test("a submission without a captcha token fails closed", async () => {
  const { handler, calls } = harness();
  const response = await submit(handler, makeRequest({ body: { ...submission, recaptchaToken: "" } }));

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { ok: false, code: "recaptcha_failed" });
  assert.equal(calls.sent.length, 0);
  assert.equal(calls.verified.length, 0);
});

test("a low captcha score is refused even when Google accepts the token", async () => {
  const { handler, calls } = harness({ verifyCaptcha: async () => ({ success: true, score: 0.1 }) });
  const response = await submit(handler);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { ok: false, code: "recaptcha_failed" });
  assert.equal(calls.sent.length, 0);
});

test("an unreachable captcha service is reported as such and sends nothing", async () => {
  const { handler, calls } = harness({
    verifyCaptcha: async () => {
      throw new Error(`connect ECONNREFUSED ${env.SMTP_HOST}`);
    },
  });
  const response = await submit(handler);

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.json(), { ok: false, code: "recaptcha_unavailable" });
  assert.equal(calls.sent.length, 0);
});

test("a send failure is generic and leaks nothing about the transport", async () => {
  const { handler } = harness({
    sendMail: async () => {
      throw new Error(`Invalid login: 535 for ${env.SMTP_USER}`);
    },
  });
  const response = await submit(handler);

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.json(), { ok: false, code: "send_failed" });
  for (const secret of secrets) assert.ok(!response.payload.includes(secret), "the response leaks a credential");
});

test("missing configuration is refused instead of silently accepting mail", async () => {
  const errors = [];
  const handler = createContactHandler({
    env: { ...env, SMTP_PASSWORD: undefined },
    logger: { error: (...args) => errors.push(args.join(" ")) },
    verifyCaptcha: async () => ({ success: true, score: 0.9 }),
    sendMail: async () => {},
  });
  const response = await submit(handler);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), { ok: false, code: "not_configured" });
  assert.match(errors.join(" "), /SMTP_PASSWORD/, "the operator needs to know which variable is missing");
  assert.ok(!response.payload.includes("SMTP_PASSWORD"), "the visitor must not learn the configuration");
});

test("only POST from this origin is accepted", async () => {
  const { handler, calls } = harness();

  const wrongMethod = makeResponse();
  await handler(makeRequest({ method: "GET", body: submission }), wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);

  const foreignOrigin = makeResponse();
  await handler(makeRequest({ body: submission, headers: { origin: "https://evil.example" } }), foreignOrigin);
  assert.equal(foreignOrigin.statusCode, 403);
  assert.deepEqual(foreignOrigin.json(), { ok: false, code: "forbidden_origin" });

  assert.equal(calls.sent.length, 0);
});

test("a body over the limit and a malformed body are both refused", async () => {
  const { handler, calls } = harness();

  const oversized = makeResponse();
  await handler(makeRequest({ body: submission, headers: { "content-length": String(contactBodyLimit + 1) } }), oversized);
  assert.equal(oversized.statusCode, 413);
  assert.deepEqual(oversized.json(), { ok: false, code: "payload_too_large" });

  const malformed = makeResponse();
  await handler(makeRequest({ stream: "{not json" }), malformed);
  assert.equal(malformed.statusCode, 400);
  assert.deepEqual(malformed.json(), { ok: false, code: "invalid_payload" });

  assert.equal(calls.sent.length, 0);
});

test("a plain Node request body is read from the stream", async () => {
  const { handler, calls } = harness();
  const response = await submit(handler, makeRequest({ stream: JSON.stringify(submission) }));

  assert.equal(response.statusCode, 200);
  assert.equal(calls.sent.length, 1);
});

test("a submitter cannot inject a mail header through the name", async () => {
  const { handler, calls } = harness();
  const injected = `Ada${newline}Bcc: victim@example.com`;
  const response = await submit(handler, makeRequest({ body: { ...submission, name: injected } }));

  assert.equal(response.statusCode, 200);

  const [mail] = calls.sent;
  assert.ok(!mail.subject.includes(String.fromCharCode(10)), "the subject carries a line break");
  assert.ok(!mail.subject.includes(String.fromCharCode(13)), "the subject carries a carriage return");
  assert.match(mail.subject, /Ada Bcc: victim@example\.com/);
  assert.equal(mail.replyTo, submission.email);
});

test("validation trims the fields and falls back to English for an unknown locale", () => {
  const result = validateSubmission({ name: "  Ada  ", email: "  ada@example.com ", message: "  hello  ", locale: "fr" });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { name: "Ada", email: "ada@example.com", message: "hello", locale: "en" });
});

test("the sender name is quoted and cannot close its own quoted string", () => {
  const mail = buildMail(
    { name: "Ada", email: "ada@example.com", message: "hello", locale: "en" },
    { recipient: "info@17tons.earth", fromName: 'Sito "17tons" <>', fromAddress: "no-reply@17tons.earth" },
  );

  assert.equal(mail.from, '"Sito \\"17tons\\" <>" <no-reply@17tons.earth>');
  assert.ok(!mail.from.includes(">, <"), "the sender string opens a second address");
});

test("the composed mail carries no html part", () => {
  const mail = buildMail(
    { name: "Ada", email: "ada@example.com", message: "<b>bold</b>", locale: "en" },
    { recipient: "info@17tons.earth", fromName: "", fromAddress: "no-reply@17tons.earth" },
  );

  assert.equal(mail.html, undefined);
  assert.equal(mail.from, "no-reply@17tons.earth");
  assert.match(mail.text, /<b>bold<\/b>/, "the message text is passed through as text");
});
