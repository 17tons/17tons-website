import React, { useEffect, useMemo, useRef, useState } from "react";
import { prepareRecaptcha, requestRecaptchaToken } from "./contact/recaptcha.js";
import { localizePage, updateMetadata } from "./i18n/index.js";
import { LocaleProvider, useI18n } from "./i18n/LocaleContext.jsx";
import { preferredLocale, resolveRoute, storageKey } from "./i18n/routing.js";

function getPreference() {
  try {
    return preferredLocale(window.localStorage, navigator.languages);
  } catch {
    return preferredLocale(null, navigator.languages);
  }
}

export default function App() {
  const [location, setLocation] = useState(() => window.location.href);
  const [isContactOpen, setContactOpen] = useState(false);
  const url = useMemo(() => new URL(location), [location]);
  const { page, locale, path } = useMemo(() => resolveRoute(url.pathname, getPreference()), [url]);
  const html = useMemo(
    () => page ? localizePage(page, locale, url.origin, `${url.search}${url.hash}`) : "",
    [page, locale, url.origin, url.search, url.hash],
  );
  const pageMarkup = useMemo(() => ({ __html: html }), [html]);

  useEffect(() => {
    const onPopState = () => {
      setContactOpen(false);
      setLocation(window.location.href);
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onPopState);
    };
  }, []);

  useEffect(() => {
    updateMetadata(page, locale, url.origin);
    document.body.className = `${page?.bodyClass ?? ""} react-site`;
    document.body.dataset.cmplz = "1";
    if (url.pathname !== path) {
      window.history.replaceState({}, "", `${path}${url.search}${url.hash}`);
    }
    try {
      window.localStorage.setItem(storageKey, locale);
    } catch {
      // An explicit locale in the URL does not depend on storage.
    }
  }, [page, locale, path, url]);

  useEffect(() => {
    initLogoMarquees();
    return initMenus();
  }, [html]);

  useEffect(() => {
    if (url.hash) {
      let id;
      try {
        id = decodeURIComponent(url.hash.slice(1));
      } catch {
        return;
      }
      document.getElementById(id)?.scrollIntoView();
    }
  }, [html, url.hash]);

  function navigate(nextPath) {
    const next = new URL(nextPath, window.location.origin);
    dismissMenus();
    if (next.href === window.location.href) return;
    window.history.pushState({}, "", next.href);
    setContactOpen(false);
    setLocation(next.href);
    if (!next.hash) window.scrollTo(0, 0);
  }

  function handleClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const anchor = event.target.closest?.("a[href]");
    if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;

    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    const target = new URL(href, window.location.origin);
    if (target.origin !== window.location.origin) return;
    const route = resolveRoute(target.pathname, locale);
    if (route.basePath === "/contact-us/") {
      event.preventDefault();
      dismissMenus();
      setContactOpen(true);
      return;
    }

    if (route.page) {
      event.preventDefault();
      navigate(`${route.path}${target.search}${target.hash}`);
    }
  }

  return (
    <LocaleProvider locale={locale}>
      {page ? (
        <div
          key={`${page.slug}-${locale}-${url.search}-${url.hash}`}
          className="react-page"
          onClick={handleClick}
          dangerouslySetInnerHTML={pageMarkup}
        />
      ) : <NotFound />}
      {isContactOpen ? <ContactModal onClose={() => setContactOpen(false)} /> : null}
    </LocaleProvider>
  );
}

function NotFound() {
  const { locale, copy } = useI18n();
  return <main className="not-found">
    <p>404</p>
    <h1>{copy.notFoundTitle}</h1>
    <p>{copy.notFoundDescription}</p>
    <a href={`/${locale}/`}>{copy.backHome}</a>
  </main>;
}

function initLogoMarquees() {
  document.querySelectorAll(".uc_logo_marquee .uc_marquee").forEach((marquee) => {
    if (marquee.dataset.reactMarquee === "1") return;

    const items = [...marquee.children].filter((item) =>
      item.classList.contains("uc_logo_marquee_holder")
    );

    if (items.length === 0) return;

    const track = document.createElement("div");
    track.className = "uc_marquee_track";

    const speed = Number(marquee.dataset.speed || 8000);
    track.style.setProperty("--marquee-duration", `${(items.length * speed) / 1000}s`);

    for (let repeat = 0; repeat < 4; repeat += 1) {
      for (const item of items) {
        const node = repeat === 0 ? item : item.cloneNode(true);
        if (repeat > 0) node.setAttribute("aria-hidden", "true");
        track.appendChild(node);
      }
    }

    marquee.appendChild(track);
    marquee.dataset.reactMarquee = "1";
  });
}

function initMenus() {
  const cleanups = [];

  document.querySelectorAll(".e-n-menu").forEach((menu) => {
    const toggle = menu.querySelector(".e-n-menu-toggle");
    const wrapper = menu.querySelector(".e-n-menu-wrapper");

    if (toggle && wrapper) {
      const onToggleClick = (event) => {
        event.preventDefault();
        const isOpen = menu.classList.toggle("react-mobile-menu-open");
        const item = wrapper.querySelector(".e-n-menu-item");

        if (item) {
          if (isOpen) {
            openMenuItem(item);
          } else {
            closeMenuItem(item);
          }
        }

        toggle.setAttribute("aria-expanded", String(isOpen));
      };

      toggle.addEventListener("click", onToggleClick);
      cleanups.push(() => toggle.removeEventListener("click", onToggleClick));
    }

    const onDelegatedClick = (event) => {
      const title = event.target.closest?.(".e-n-menu-title");
      if (!title || !menu.contains(title)) return;

      const item = title.closest(".e-n-menu-item");
      if (!item?.querySelector(".e-n-menu-content")) return;

      event.preventDefault();
      if (!window.matchMedia("(max-width: 1024px)").matches) {
        openMenuItem(item);
        return;
      }
      const isOpen = item.classList.contains("react-menu-item-open");

      if (isOpen) {
        closeMenuItem(item);
        menu.classList.remove("react-mobile-menu-open");
        toggle?.setAttribute("aria-expanded", "false");
      } else {
        menu.classList.add("react-mobile-menu-open");
        openMenuItem(item);
        toggle?.setAttribute("aria-expanded", "true");
      }
    };

    menu.addEventListener("click", onDelegatedClick);
    cleanups.push(() => menu.removeEventListener("click", onDelegatedClick));

    const onEscape = (event) => {
      if (event.key !== "Escape") return;
      const item = menu.querySelector(".react-menu-item-open");
      if (!item) return;
      item.querySelector(".site-mobile-menu-trigger, .e-n-menu-dropdown-icon")?.focus();
      closeMenuItem(item);
      menu.classList.remove("react-mobile-menu-open");
      toggle?.setAttribute("aria-expanded", "false");
    };
    menu.addEventListener("keydown", onEscape);
    cleanups.push(() => menu.removeEventListener("keydown", onEscape));

    const summaries = [...menu.querySelectorAll("summary")];
    const onAccordionKeyDown = (event) => {
      const index = summaries.indexOf(event.target.closest("summary"));
      if (index < 0) return;
      let next;
      if (event.key === "ArrowDown") next = (index + 1) % summaries.length;
      if (event.key === "ArrowUp") next = (index - 1 + summaries.length) % summaries.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = summaries.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      summaries[next].focus();
    };
    menu.addEventListener("keydown", onAccordionKeyDown);
    cleanups.push(() => menu.removeEventListener("keydown", onAccordionKeyDown));

    menu.querySelectorAll(".e-n-menu-item").forEach((item) => {
      const title = item.querySelector(".e-n-menu-title");
      const content = item.querySelector(".e-n-menu-content");
      if (!title || !content) return;

      const open = () => {
        if (!window.matchMedia("(max-width: 1024px)").matches) {
          openMenuItem(item);
        }
      };
      const close = () => {
        if (!window.matchMedia("(max-width: 1024px)").matches && !item.contains(document.activeElement)) {
          closeMenuItem(item);
        }
      };
      const onFocusOut = (event) => {
        if (!item.contains(event.relatedTarget) && !item.matches(":hover")) closeMenuItem(item);
      };

      item.addEventListener("mouseenter", open);
      item.addEventListener("mouseleave", close);
      title.addEventListener("focusin", open);
      item.addEventListener("focusout", onFocusOut);
      cleanups.push(() => {
        item.removeEventListener("mouseenter", open);
        item.removeEventListener("mouseleave", close);
        title.removeEventListener("focusin", open);
        item.removeEventListener("focusout", onFocusOut);
      });
    });
  });

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

function dismissMenus() {
  document.querySelectorAll(".e-n-menu").forEach((menu) => {
    menu.querySelectorAll(".react-menu-item-open").forEach(closeMenuItem);
    menu.classList.remove("react-mobile-menu-open");
    menu.querySelector(".e-n-menu-toggle")?.setAttribute("aria-expanded", "false");
  });
}

function openMenuItem(item) {
  const content = item.querySelector(".e-n-menu-content");
  const panel = content?.firstElementChild;
  const menu = item.closest(".e-n-menu");

  menu?.querySelectorAll(".e-n-menu-item.react-menu-item-open").forEach((openItem) => {
    if (openItem !== item) closeMenuItem(openItem);
  });

  item.classList.add("react-menu-item-open");
  content?.classList.add("e-active");
  panel?.classList.add("e-active", "animated", "fadeIn");
  item.querySelector(".e-n-menu-dropdown-icon")?.setAttribute("aria-expanded", "true");
  item.querySelector(".site-mobile-menu-trigger")?.setAttribute("aria-expanded", "true");
}

function closeMenuItem(item) {
  const content = item.querySelector(".e-n-menu-content");
  const panel = content?.firstElementChild;

  item.classList.remove("react-menu-item-open");
  content?.classList.remove("e-active");
  panel?.classList.remove("e-active", "animated", "fadeIn");
  item.querySelector(".e-n-menu-dropdown-icon")?.setAttribute("aria-expanded", "false");
  item.querySelector(".site-mobile-menu-trigger")?.setAttribute("aria-expanded", "false");
}

function ContactModal({ onClose }) {
  const { copy, locale } = useI18n();
  const panelRef = useRef(null);
  const statusRef = useRef(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    const previousFocus = document.activeElement;
    const panel = panelRef.current;
    panel.querySelector("input")?.focus();
    prepareRecaptcha();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = [...panel.querySelectorAll("button, input, textarea, a[href]")];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener("keydown", onKeyDown);
    return () => {
      panel.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (status === "sent") statusRef.current?.focus();
  }, [status]);

  async function submit(event) {
    event.preventDefault();
    if (status === "sending") return;

    // Read the fields before the first await: React clears the event's currentTarget once it yields.
    const fields = new FormData(event.currentTarget);
    setStatus("sending");

    const payload = {
      name: fields.get("name") ?? "",
      email: fields.get("email") ?? "",
      message: fields.get("message") ?? "",
      website: fields.get("website") ?? "",
      locale,
      recaptchaToken: await requestRecaptchaToken("contact"),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`contact endpoint responded with ${response.status}`);
      setStatus("sent");
    } catch {
      setStatus("error");
    } finally {
      clearTimeout(timeout);
    }
  }

  return (
    <div className="contact-backdrop" role="dialog" aria-modal="true" aria-labelledby="contact-title">
      <div className="contact-panel" ref={panelRef}>
        <button className="contact-close" type="button" aria-label={copy.contactClose} onClick={onClose}>
          &times;
        </button>
        <div className="contact-copy">
          <h2 id="contact-title">{copy.contactTitle}</h2>
          <p>{copy.contactDescription}</p>
        </div>
        {status === "sent" ? (
          <p className="contact-sent" role="status" tabIndex={-1} ref={statusRef}>{copy.contactSent}</p>
        ) : (
          <form className="contact-form" onSubmit={submit}>
            <input type="text" name="name" placeholder={copy.name} aria-label={copy.name} autoComplete="name" required />
            <input type="email" name="email" placeholder={copy.email} aria-label={copy.email} autoComplete="email" required />
            <textarea name="message" rows="5" placeholder={copy.message} aria-label={copy.message} required />
            {/* Left empty by people; a filled one is answered like a delivered message and discarded. */}
            <input className="contact-honeypot" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            {status === "error" ? <p className="contact-error" role="alert">{copy.contactError}</p> : null}
            <label className="contact-acceptance">
              <input type="checkbox" required />
              <span>{copy.privacyConsent}<a href="/live-assets/wp-content/uploads/2024/12/Policy-privacy-sito-17tons.pdf" target="_blank" rel="noreferrer">{copy.privacyPolicy}</a></span>
            </label>
            <button type="submit" disabled={status === "sending"}>{status === "sending" ? copy.contactSending : copy.send}</button>
            <p className="contact-recaptcha">
              {copy.recaptchaNotice}{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">{copy.recaptchaPrivacy}</a>
              {" "}{copy.recaptchaConjunction}{" "}
              <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">{copy.recaptchaTerms}</a>.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
