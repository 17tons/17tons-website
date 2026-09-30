import assert from "node:assert/strict";
import test from "node:test";
import { createLambdaHandler, toContactRequest } from "../server/contact/lambda.js";
import { createContactHandler } from "../server/contact/message.js";

const submission = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "We would like to monitor a reforestation project.",
  website: "",
  locale: "en",
  recaptchaToken: "captcha-token",
};

function functionUrlEvent({ method = "POST", body, isBase64Encoded = false, headers = {} } = {}) {
  return {
    version: "2.0",
    headers: { host: "abc123.lambda-url.eu-central-1.on.aws", origin: "https://17tons.earth", ...headers },
    requestContext: { http: { method, sourceIp: "198.51.100.7" } },
    body,
    isBase64Encoded,
  };
}

function lambda() {
  const calls = { sent: [], verified: [] };
  const handler = createLambdaHandler(
    createContactHandler({
      env: { CONTACT_SENDER_EMAIL: "website@17tons.tech", CONTACT_RECIPIENT: "info@17tons.earth", RECAPTCHA_SECRET: "secret" },
      allowedHosts: ["17tons.earth"],
      logger: { error() {} },
      verifyCaptcha: async (token, ip, action) => {
        calls.verified.push({ token, ip, action });
        return { success: true, score: 0.9 };
      },
      sendMail: async (mail) => {
        calls.sent.push(mail);
      },
    }),
  );

  return { handler, calls };
}

test("a function URL submission is delivered and answered as JSON", async () => {
  const { handler, calls } = lambda();
  const response = await handler(functionUrlEvent({ body: JSON.stringify(submission) }));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(calls.sent.length, 1);
  assert.equal(calls.sent[0].to, "info@17tons.earth");
});

test("a base64-encoded body is decoded before it is read", async () => {
  const { handler, calls } = lambda();
  const body = Buffer.from(JSON.stringify(submission), "utf8").toString("base64");
  const response = await handler(functionUrlEvent({ body, isBase64Encoded: true }));

  assert.equal(response.statusCode, 200);
  assert.equal(calls.sent.length, 1);
});

test("the visitor address comes from the proxy chain, then from the function URL source", async () => {
  const { handler, calls } = lambda();
  await handler(functionUrlEvent({ body: JSON.stringify(submission), headers: { "x-forwarded-for": "203.0.113.4, 64.252.1.1" } }));
  await handler(functionUrlEvent({ body: JSON.stringify(submission) }));

  assert.deepEqual(calls.verified.map((call) => call.ip), ["203.0.113.4", "198.51.100.7"]);
});

test("a request without a body or with another method is refused", async () => {
  const { handler, calls } = lambda();

  const empty = await handler(functionUrlEvent({}));
  assert.equal(empty.statusCode, 400);
  assert.deepEqual(JSON.parse(empty.body), { ok: false, code: "invalid_payload" });

  const get = await handler(functionUrlEvent({ method: "GET" }));
  assert.equal(get.statusCode, 405);

  assert.equal(calls.sent.length, 0);
});

test("the request adapter keeps the headers the handler relies on", () => {
  const request = toContactRequest(functionUrlEvent({ body: "{}", headers: { "content-length": "2" } }));

  assert.equal(request.method, "POST");
  assert.equal(request.headers.origin, "https://17tons.earth");
  assert.equal(request.headers["content-length"], "2");
  assert.equal(request.body, "{}");
  assert.equal(request.socket.remoteAddress, "198.51.100.7");
});
