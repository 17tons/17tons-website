import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pages } from "../src/generated/pages.js";
import { messages } from "../src/i18n/messages.js";
import { translate } from "../src/i18n/index.js";
import { elementOverrides } from "../src/i18n/overrides.js";
import { locales } from "../src/i18n/routing.js";

// Wording reviewed and approved by the client on 17/09/2026. The source keys are the snapshot text
// nodes; the values are the Italian the client asked for. Changing either is a client decision.
const approved = {
  "Backed by Industry Leaders": "Supporto da leader di settore",
  "A dMRV (digital Monitoring, Reporting & Verification) platform designed for land-based projects.": "Una piattaforma dMRV (digital Monitoring, Reporting & Verification) pensata per i progetti land-based.",
  "We integrate data from remote sensing, in-situ sensors, and lab analyses to measure every key parameter: carbon removal, climate, soil, biodiversity, and water.": "Integriamo dati da remote sensing, sensori in-situ e analisi di laboratorio per misurare ogni parametro rilevante: carbonio rimosso, clima, suolo, biodiversità, acqua.",
  "Tangible Impact": "Impatto reale",
  "hectares of land": "ettari di terra",
  "Customised Land-Based Projects": "Progetti land-based su misura",
  // The same card image on the home page carries its label as title and alt attributes.
  "Progetti Land-based su misura": "Progetti land-based su misura",
  // The page's own name follows the same term, in the menu, the heading and the metadata.
  "Custom Project": "Progetti land-based su misura",
  "Your land-based project, tailored and verifiable in every detail": "Il tuo progetto land-based, su misura e verificabile in ogni dettaglio",
  "With Metatons, you can make all the benefits of land-based projects visible, traceable, and verifiable—not only the carbon removal but also systemic impacts on soil, climate, water, and biodiversity.": "Con Metatons puoi rendere visibili, tracciabili e verificabili tutti i benefici dei progetti land-based: dalla rimozione del carbonio agli impatti sistemici su suolo, clima, acqua e biodiversità.",
  "Whether you’re launching, developing, or certifying a land-based project, we help turn complex requirements into measurable, certified value.": "Che tu stia avviando, sviluppando o certificando un progetto land-based, ti aiutiamo a trasformare requisiti complessi in valore misurabile e certificato.",
  // The home grid icons carry their label as title and alt attributes too.
  "Monitoraggio Multi-dimensione": "Monitoraggio multi-dimensione",
  "Your tailor-made land-based project, verifiable in every detail": "Il tuo progetto land-based su misura, verificabile in ogni dettaglio",
  "Transparency by Design": "Trasparenza by design",
  "Audit trails and open project data": "Audit trail e dati open di progetto",
  "Innovative Pathways To Reach A Net-Zero World": "Un percorso innovativo per raggiungere un mondo a quasi zero emissioni",
  "In an increasingly dynamic global landscape filled with challenges but also brimming with opportunities, 17tons emerged from an unwavering principle: to regenerate natural capital for sustainable living.": "In un panorama globale ricco di sfide ma anche di opportunità, 17tons si contraddistingue per un principio incrollabile: per raggiungere la sostenibilità occorre rigenerare il capitale naturale.",
  "This isn’t just an abstract concept": "Non si tratta di una convinzione astratta",
  "; it’s deeply embedded and guides us forward, spurring our ambition and driving our actions towards meaningful change.": ". È la bussola che ci spinge avanti, che guida le nostre azioni verso il cambiamento necessario.",
  "Every land-based project is unique. That’s why Metatons provides a modular land intelligence system, designed around the specific needs of your intervention or monitoring needs (e.g., in relation to TNFD or ESRS E4). Whether your focus is soil regeneration, conservation, sustainable land management, or mixed-use initiatives, you can choose what to monitor, how, and how often, combining in-situ sensors, remote sensing, and on-site surveys.": "Ogni progetto land-based è unico. Per questo Metatons offre un sistema di land intelligence modulare, costruito attorno alle esigenze specifiche del tuo intervento o necessità di monitoraggio (ad esempio in relazione a TNFD o ESRS E4). Che si tratti di rigenerazione suoli, conservazione, gestione sostenibile dei territori o interventi misti, puoi decidere cosa monitorare, come e con quale frequenza, combinando sensori in-situ, remote sensing e rilievi sul campo.",
  "The philosophy of 17tons is grounded in the belief that land-based CDR projects cannot be evaluated solely on the quantity of carbon removed. Monitoring and valuing additional environmental co-benefits is equally essential, including:": "La filosofia di 17tons si basa sulla convinzione che i progetti CDR land-based non possano essere valutati esclusivamente sulla base della quantità di carbonio rimosso. È fondamentale monitorare e valorizzare anche i co-benefici ambientali generati:",
};

// The brand claim is not translated on any page, in either locale, including as image alt text.
const brandClaim = [
  "Proof of Value.",
  "Beyond the Tons",
  "Proof of Value. Beyond the Tons",
  "Proof of The Value Beyond the Tons",
];

// Italian wording the client replaced. None of it may come back as a catalogue value.
const retired = [
  "Il valore, dimostrato.",
  "Oltre le tonnellate",
  "Al fianco dei leader del settore",
  "Una piattaforma dMRV (monitoraggio, rendicontazione e verifica digitali) progettata per i progetti sul territorio.",
  "multidimensionale",
  "Monitoraggio multidimensionale",
  "Impatto concreto",
  "ettari di territorio",
  "Progetti sul territorio su misura",
  "Il tuo progetto sul territorio su misura, verificabile in ogni dettaglio",
  "Trasparenza fin dalla progettazione",
  "Tracce di audit e dati di progetto aperti",
  "Percorsi innovativi verso un mondo a emissioni nette zero",
  "Non è un semplice concetto astratto",
  ": è un principio radicato che ci guida, alimenta la nostra ambizione e orienta le nostre azioni verso un cambiamento concreto.",
  "La dimostrazione del valore oltre le tonnellate",
];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The snapshot nests widgets, so the window ends at the next widget rather than at the closing tag.
function widgetMarkup(page, elementId) {
  const start = page.html.indexOf(`data-id="${elementId}"`);
  assert.notEqual(start, -1, `widget ${elementId} is not in the ${page.slug} snapshot`);
  const next = page.html.indexOf('data-id="', start + 1);
  return page.html.slice(start, next === -1 ? page.html.length : next);
}

test("the client-approved Italian copy is in the catalogue", () => {
  for (const [source, italian] of Object.entries(approved)) {
    assert.equal(translate(source, "it"), italian, source);
  }
});

test("retired Italian wording cannot come back through the catalogue", () => {
  for (const locale of locales) {
    const values = new Set(Object.values(messages[locale]).filter((value) => typeof value === "string"));
    for (const table of [messages[locale].titles, messages[locale].descriptions]) {
      for (const value of Object.values(table)) values.add(value);
    }
    for (const value of Object.values(messages[locale].attributes ?? {})) values.add(value);
    for (const phrase of retired) {
      assert.ok(!values.has(phrase), `${locale} still renders ${phrase}`);
    }
  }
  // The catalogue is a flat map, so reading the module directly asserts on its values rather than
  // on what a lookup happens to resolve to.
  const source = readFileSync(new URL("../src/i18n/locales/it.js", import.meta.url), "utf8");
  const values = [...source.matchAll(/^\s*"(?:[^"\\]|\\.)*":\s*"((?:[^"\\]|\\.)*)",\s*$/gm)]
    .map(([, value]) => value);
  for (const phrase of retired) {
    assert.ok(!values.includes(phrase), `the Italian catalogue still contains ${phrase}`);
  }
});

function translateCatalog() {
  // Reading the module directly keeps the assertion about values, not about lookup.
  const source = readFileSync(new URL("../src/i18n/locales/it.js", import.meta.url), "utf8");
  return Object.fromEntries([...source.matchAll(/^\s*"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)",\s*$/gm)]
    .map(([, key, value]) => [key, value]));
}

test("the brand claim stays in English in both catalogues", () => {
  for (const locale of locales) {
    for (const phrase of brandClaim) {
      assert.equal(translate(phrase, locale), phrase, `${locale}: ${phrase}`);
    }
  }
  // The claim reaches the browser tab through the page title, so the two locales agree on it.
  assert.equal(messages.it.titles.home, messages.en.titles.home);
});

test("widget-scoped overrides keep the home heading and the home stat tile apart", () => {
  const home = pages.find((page) => page.slug === "home");

  // The snapshot reuses the source text node "Monitoring" in two different widgets that the client
  // wants translated differently, so the catalogue cannot carry both: it holds the tile label and
  // the heading is overridden per widget.
  const occurrences = [...home.html.matchAll(/>\s*Monitoring\s*</g)].length;
  assert.ok(occurrences >= 2, "the Monitoring collision is gone; the override may be redundant");

  for (const [locale, elements] of Object.entries(elementOverrides)) {
    for (const [elementId, scoped] of Object.entries(elements)) {
      const page = pages.find((candidate) => candidate.html.includes(`data-id="${elementId}"`));
      assert.ok(page, `override for ${elementId} targets no page`);
      const markup = widgetMarkup(page, elementId);
      for (const [source, italian] of Object.entries(scoped)) {
        assert.match(markup, new RegExp(`>\\s*${escape(source)}\\s*<`), `${elementId} does not render ${source}`);
        assert.notEqual(italian, translate(source, locale), `${elementId} override duplicates the ${locale} catalogue`);
      }
    }
  }

  assert.equal(elementOverrides.it["91cfe0e"].Monitoring, "multi-dimensione");
  assert.equal(translate("Monitoring", "it"), "Monitoraggio");
  assert.equal(translate("Multi-Dimensional", "it"), "Monitoraggio");
});

test("the contact dialog carries the client's reCAPTCHA notice and green submit button", () => {
  for (const locale of locales) {
    const copy = messages[locale];
    for (const key of ["recaptchaNotice", "recaptchaPrivacy", "recaptchaConjunction", "recaptchaTerms"]) {
      assert.ok(copy[key], `${locale} is missing ${key}`);
    }
    assert.match(copy.recaptchaNotice, /reCAPTCHA/);
    assert.doesNotMatch(copy.recaptchaNotice, /reCAPCHA\b/);
  }
  assert.equal(messages.en.recaptchaNotice, "This site is protected by reCAPTCHA and Google:");

  const css = readFileSync(new URL("../src/styles/app.css", import.meta.url), "utf8");
  const submit = css.match(/\.contact-form button\[type="submit"\]\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(submit, /background:\s*#cdffc2/, "the submit button is not the brand green");
  assert.match(submit, /justify-self:\s*start/, "the submit button still fills the dialog width");
});

test("the dialog repeats the notice the footer already carries, word for word", () => {
  // The footer notice is part of the snapshot; the dialog is React copy. The client asked for the
  // notice in the contact window, so both must say the same thing rather than diverge.
  for (const locale of locales) {
    assert.equal(messages[locale].recaptchaNotice, translate("This site is protected by reCAPTCHA and Google:", locale));
    assert.equal(messages[locale].recaptchaPrivacy, translate("privacy policy", locale));
    assert.equal(messages[locale].recaptchaTerms, translate("terms of service", locale));
  }
  assert.equal(messages.it.recaptchaConjunction, "e");
  assert.equal(messages.en.recaptchaConjunction, "and");
});

test("the consent label carries the space the link needs in each language", () => {
  // The anchor follows the label with no separator of its own, so the space has to come from the
  // translation: Italian elides it after the apostrophe, English does not.
  assert.match(messages.en.privacyConsent, / $/);
  assert.doesNotMatch(messages.it.privacyConsent, /\s$/);
  assert.match(messages.it.privacyConsent, /l’$/);
});
