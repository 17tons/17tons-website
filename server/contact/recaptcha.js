// Server-side reCAPTCHA v3 verification for the contact form.

export function createRecaptchaVerifier(secret) {
  return async function verifyCaptcha(token, ip, action) {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);

    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", { method: "POST", body });
    if (!response.ok) throw new Error(`reCAPTCHA verification responded with ${response.status}`);

    const verdict = await response.json();

    return {
      // The action ties the token to this form, so a token minted elsewhere cannot be replayed here.
      success: verdict.success === true && verdict.action === action,
      score: Number(verdict.score ?? 0),
    };
  };
}
