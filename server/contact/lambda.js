// Adapts a Lambda function URL event to the Node-style request and response the contact handler
// works with, so the handler stays independent of the runtime it is deployed on.

export function toContactRequest(event) {
  const http = event?.requestContext?.http ?? {};
  const raw = event?.body ?? "";

  return {
    method: http.method ?? "GET",
    headers: event?.headers ?? {},
    body: event?.isBase64Encoded ? Buffer.from(raw, "base64").toString("utf8") : raw,
    socket: { remoteAddress: http.sourceIp ?? "" },
  };
}

export function createLambdaHandler(contactHandler) {
  return async function handler(event) {
    const result = { statusCode: 200, headers: {}, body: "" };
    const res = {
      set statusCode(value) {
        result.statusCode = value;
      },
      get statusCode() {
        return result.statusCode;
      },
      setHeader(name, value) {
        result.headers[name.toLowerCase()] = String(value);
      },
      end(chunk) {
        result.body = chunk === undefined ? "" : String(chunk);
      },
    };

    await contactHandler(toContactRequest(event), res);
    return result;
  };
}
