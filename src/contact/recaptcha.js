// reCAPTCHA v3, loaded on demand the first time the contact dialog opens.
//
// The snapshot deliberately carries no third-party scripts, so the Google script is never loaded for
// a visitor who does not open the dialog. The site key is public by design; the secret lives only in
// the contact Lambda's environment.

const siteKey = (import.meta.env && import.meta.env.VITE_RECAPTCHA_SITE_KEY) || "";
const scriptId = "contact-recaptcha";

let pending;

function load() {
  if (!siteKey) return Promise.resolve(null);
  if (pending) return pending;

  pending = new Promise((resolve) => {
    if (window.grecaptcha?.ready) {
      window.grecaptcha.ready(() => resolve(window.grecaptcha));
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.onload = () => {
      if (window.grecaptcha?.ready) window.grecaptcha.ready(() => resolve(window.grecaptcha));
      else resolve(null);
    };
    script.onerror = () => {
      // Forget the failure so a later submission can try again.
      script.remove();
      pending = undefined;
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return pending;
}

export function prepareRecaptcha() {
  load();
}

export async function requestRecaptchaToken(action) {
  const grecaptcha = await load();
  if (!grecaptcha) return "";

  try {
    return await grecaptcha.execute(siteKey, { action });
  } catch {
    return "";
  }
}
