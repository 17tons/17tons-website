import React, { useEffect, useMemo, useState } from "react";
import { pages } from "./generated/pages.js";

const knownPaths = new Map();

for (const page of pages) {
  knownPaths.set(normalizePath(page.path), page);
  for (const alias of page.aliases ?? []) {
    knownPaths.set(normalizePath(alias), page);
  }
}

function normalizePath(pathname) {
  if (!pathname || pathname === "/index.html") return "/";
  const withoutHash = pathname.split("#")[0].split("?")[0];
  if (withoutHash === "") return "/";
  return withoutHash.endsWith("/") ? withoutHash : `${withoutHash}/`;
}

function routeForHref(rawHref) {
  if (!rawHref || rawHref.startsWith("#")) return null;

  let url;
  try {
    url = new URL(rawHref, window.location.origin);
  } catch {
    return null;
  }

  const path = normalizePath(url.pathname);
  if (url.origin === window.location.origin && knownPaths.has(path)) return path;

  return null;
}

function isContactHref(rawHref) {
  if (!rawHref) return false;

  try {
    const url = new URL(rawHref, window.location.origin);
    return normalizePath(url.pathname) === "/contact-us/";
  } catch {
    return rawHref.includes("/contact-us/");
  }
}

export default function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
  const [isContactOpen, setContactOpen] = useState(false);
  const page = useMemo(() => knownPaths.get(path) ?? knownPaths.get("/"), [path]);

  useEffect(() => {
    const onPopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.title = page.title;
    document.documentElement.lang = "en";
    document.body.className = `${page.bodyClass} react-site`;
    document.body.dataset.cmplz = "1";
  }, [page]);

  useEffect(() => {
    initLogoMarquees();
    return initMenus();
  }, [page]);

  function navigate(nextPath) {
    const normalized = normalizePath(nextPath);
    if (normalized === path) return;
    window.history.pushState({}, "", normalized);
    setPath(normalized);
    window.scrollTo(0, 0);
  }

  function handleClick(event) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) {
      return;
    }

    const anchor = event.target.closest?.("a[href]");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (isContactHref(href)) {
      event.preventDefault();
      setContactOpen(true);
      return;
    }

    const route = routeForHref(href);
    if (route) {
      event.preventDefault();
      navigate(route);
    }
  }

  return (
    <>
      <div
        className="react-page"
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
      {isContactOpen ? <ContactModal onClose={() => setContactOpen(false)} /> : null}
    </>
  );
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
        toggle.setAttribute("aria-expanded", String(isOpen));
      };

      toggle.addEventListener("click", onToggleClick);
      cleanups.push(() => toggle.removeEventListener("click", onToggleClick));
    }

    const toggleItem = (item) => {
      if (item.classList.contains("react-menu-item-open")) {
        closeMenuItem(item);
      } else {
        openMenuItem(item);
      }
    };

    const onDelegatedClick = (event) => {
      if (!window.matchMedia("(max-width: 1024px)").matches) return;

      const title = event.target.closest?.(".e-n-menu-title");
      if (!title || !menu.contains(title)) return;

      const item = title.closest(".e-n-menu-item");
      if (!item?.querySelector(".e-n-menu-content")) return;

      event.preventDefault();
      toggleItem(item);
    };

    menu.addEventListener("click", onDelegatedClick);
    cleanups.push(() => menu.removeEventListener("click", onDelegatedClick));

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
        if (!window.matchMedia("(max-width: 1024px)").matches) {
          closeMenuItem(item);
        }
      };

      item.addEventListener("mouseenter", open);
      item.addEventListener("mouseleave", close);
      title.addEventListener("focusin", open);
      cleanups.push(() => {
        item.removeEventListener("mouseenter", open);
        item.removeEventListener("mouseleave", close);
        title.removeEventListener("focusin", open);
      });
    });
  });

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

function openMenuItem(item) {
  const content = item.querySelector(".e-n-menu-content");
  const panel = content?.firstElementChild;

  item.classList.add("react-menu-item-open");
  content?.classList.add("e-active");
  panel?.classList.add("e-active", "animated", "fadeIn");
  item.querySelector(".e-n-menu-dropdown-icon")?.setAttribute("aria-expanded", "true");
}

function closeMenuItem(item) {
  const content = item.querySelector(".e-n-menu-content");
  const panel = content?.firstElementChild;

  item.classList.remove("react-menu-item-open");
  content?.classList.remove("e-active");
  panel?.classList.remove("e-active", "animated", "fadeIn");
  item.querySelector(".e-n-menu-dropdown-icon")?.setAttribute("aria-expanded", "false");
}

function ContactModal({ onClose }) {
  return (
    <div className="contact-backdrop" role="dialog" aria-modal="true" aria-labelledby="contact-title">
      <div className="contact-panel">
        <button className="contact-close" type="button" aria-label="Close contact form" onClick={onClose}>
          &times;
        </button>
        <div className="contact-copy">
          <h2 id="contact-title">Contact us</h2>
          <p>
            Whether you are looking for a new professional challenge, a technology partner,
            or a solution to monitor your environmental project, tell us in a few lines
            who you are and what you need-the 17tons team will get back to you as soon
            as possible.
          </p>
        </div>
        <form className="contact-form" onSubmit={(event) => event.preventDefault()}>
          <input type="text" placeholder="Name" aria-label="Name" />
          <input type="email" placeholder="E-mail" aria-label="E-mail" required />
          <textarea rows="5" placeholder="Message" aria-label="Message" />
          <label className="contact-acceptance">
            <input type="checkbox" required />
            <span>I confirm that I have read, consent and agree to the Privacy Policy</span>
          </label>
          <button type="submit">Send Your Message</button>
        </form>
      </div>
    </div>
  );
}
