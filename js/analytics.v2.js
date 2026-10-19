/* GA4 loader. Served as /js/analytics.v2.js.
 *
 * /js/* is cached immutable for one year. This filename is the cache bust
 * for the old unconditional /js/analytics.js. Do not point pages at that URL.
 * Bump the filename again if this behavior changes.
 *
 * The Google tag is injected only after an explicit grant. Consent starts
 * denied. Nothing here contacts Google, creates a dataLayer, or defines gtag
 * until localStorage holds exactly "granted". There is no default-denied
 * Consent Mode ping.
 *
 * Measurement ID: G-JCNLL09KHW (instilligent.com, wired 2026-06-22).
 */
(function () {
  var GA4_ID = "G-JCNLL09KHW";
  var STORAGE_KEY = "instilligent.analytics_consent";
  var GA_SRC = "https://www.googletagmanager.com/gtag/js?id=" + GA4_ID;
  var DISABLE_KEY = "ga-disable-" + GA4_ID;

  var gaLoaded = false;
  var tagConsent = null;
  var collectionStopped = false;
  var panelOpen = false;
  var banner = null;
  var launcher = null;
  var statusEl = null;

  function storageGet() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function storageSet(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
      return storageGet() === value;
    } catch (e) {
      return false;
    }
  }

  function setDisabled(disabled) {
    window[DISABLE_KEY] = disabled;
  }

  /* Only the exact stored grant may load the tag. */
  function loadGa() {
    if (gaLoaded) return;
    if (collectionStopped) return;
    if (window[DISABLE_KEY] === true) return;
    if (storageGet() !== "granted") return;

    var parent = document.head || document.documentElement;
    if (!parent) return;

    gaLoaded = true;
    tagConsent = "granted";
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    /* Grant is already stored. Set granted before the script request so the
       first hit is not a denied Consent Mode ping. */
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      functionality_storage: "granted",
      security_storage: "granted"
    });

    var script = document.createElement("script");
    script.async = true;
    script.src = GA_SRC;
    parent.appendChild(script);

    window.gtag("js", new Date());
    window.gtag("config", GA4_ID);
  }

  /* Stop an already-injected tag. The disable flag is set first. A denied
     consent update follows when the real gtag function is still in place.
     Callers reload after a saved withdrawal so the running library is discarded. */
  function stopCollection() {
    setDisabled(true);
    collectionStopped = true;
    if (gaLoaded && tagConsent !== "denied" && typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });
    }
    tagConsent = "denied";
  }

  /* Resume a tag that was already injected, then withdrawn, on this page. */
  function allowLoadedTag() {
    if (!gaLoaded || tagConsent === "granted" || typeof window.gtag !== "function") return;
    tagConsent = "granted";
    window.gtag("consent", "update", {
      analytics_storage: "granted"
    });
  }

  function analyticsAllowed() {
    return !collectionStopped &&
      window[DISABLE_KEY] !== true &&
      storageGet() === "granted" &&
      typeof window.gtag === "function";
  }

  function syncUi() {
    if (!banner || !launcher || !statusEl) return;
    var choice = storageGet();
    var decided = choice === "granted" || choice === "denied";

    /* In-memory stop without a saved denial. Do not say analytics is off. */
    if (collectionStopped && choice !== "denied") {
      panelOpen = true;
      statusEl.textContent = "Analytics is stopped in this tab. This browser did not save that choice, so a new visit can turn it on again.";
      banner.hidden = false;
      launcher.hidden = true;
      return;
    }

    if (!decided) {
      panelOpen = true;
      statusEl.textContent = "Analytics is off until you accept.";
      banner.hidden = false;
      launcher.hidden = true;
      return;
    }

    statusEl.textContent = choice === "granted"
      ? "Analytics is on. Decline to turn it off."
      : "Analytics is off. Accept to turn it on.";
    banner.hidden = !panelOpen;
    launcher.hidden = panelOpen;
  }

  function closePanelAndFocusLauncher() {
    panelOpen = false;
    syncUi();
    if (launcher && typeof launcher.focus === "function") launcher.focus();
  }

  function reloadPage() {
    if (window.location && typeof window.location.reload === "function") {
      window.location.reload();
    }
  }

  function choose(value) {
    if (value !== "granted" && value !== "denied") return;

    if (value === "granted") {
      if (!storageSet("granted")) {
        if (statusEl) {
          statusEl.textContent = "This browser blocked saving your choice, so analytics stays off.";
        }
        return;
      }
      collectionStopped = false;
      setDisabled(false);
      closePanelAndFocusLauncher();
      if (gaLoaded) allowLoadedTag();
      else loadGa();
      return;
    }

    var saved = storageSet("denied");
    var hadTag = gaLoaded && !collectionStopped;
    stopCollection();
    if (!saved) {
      panelOpen = true;
      syncUi();
      return;
    }
    closePanelAndFocusLauncher();
    if (hadTag) reloadPage();
  }

  function onStorage(e) {
    if (!e || e.key !== STORAGE_KEY) return;
    if (e.newValue === "granted") return;
    var hadTag = gaLoaded && !collectionStopped;
    stopCollection();
    if (hadTag) {
      reloadPage();
      return;
    }
    panelOpen = false;
    syncUi();
  }

  function buildUi() {
    banner = document.createElement("div");
    banner.id = "analytics-consent";
    banner.className = "analytics-consent";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "false");
    banner.setAttribute("aria-labelledby", "analytics-consent-title");

    var title = document.createElement("h2");
    title.id = "analytics-consent-title";
    title.textContent = "Analytics consent";

    var body = document.createElement("p");
    body.textContent = "We use Google Analytics to measure page visits. It stays off until you accept. Accept loads it in this browser. Decline leaves it off. Withdrawing consent stops it in this tab and on later visits.";

    statusEl = document.createElement("p");
    statusEl.id = "analytics-consent-status";
    statusEl.className = "analytics-consent__status";
    statusEl.setAttribute("aria-live", "polite");

    var actions = document.createElement("div");
    actions.className = "analytics-consent__actions";

    var accept = document.createElement("button");
    accept.type = "button";
    accept.className = "btn btn-primary btn-sm";
    accept.setAttribute("data-analytics-choice", "granted");
    accept.textContent = "Accept";
    accept.addEventListener("click", function () { choose("granted"); });

    var decline = document.createElement("button");
    decline.type = "button";
    decline.className = "btn btn-outline btn-sm";
    decline.setAttribute("data-analytics-choice", "denied");
    decline.textContent = "Decline";
    decline.addEventListener("click", function () { choose("denied"); });

    var privacy = document.createElement("a");
    privacy.href = "/pages/privacy#cookies";
    privacy.textContent = "Privacy policy";

    actions.appendChild(accept);
    actions.appendChild(decline);
    actions.appendChild(privacy);

    banner.appendChild(title);
    banner.appendChild(body);
    banner.appendChild(statusEl);
    banner.appendChild(actions);

    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.id = "analytics-consent-launcher";
    launcher.className = "btn btn-outline btn-sm analytics-consent-launcher";
    launcher.textContent = "Analytics choices";
    launcher.addEventListener("click", function () {
      panelOpen = true;
      syncUi();
      accept.focus();
    });

    document.body.appendChild(banner);
    document.body.appendChild(launcher);

    document.addEventListener("keydown", function (e) {
      if (!e || e.key !== "Escape" || !panelOpen) return;
      var choice = storageGet();
      if (choice !== "granted" && choice !== "denied") return;
      if (collectionStopped && choice !== "denied") return;
      closePanelAndFocusLauncher();
    });
  }

  document.addEventListener("click", function (e) {
    if (!analyticsAllowed()) return;
    var target = e && e.target;
    var el = target && target.closest ? target.closest("[data-cf-event]") : null;
    if (!el) return;
    var name = el.getAttribute("data-cf-event");
    if (!name) return;
    var params = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var attr = el.attributes[i];
      if (attr.name.indexOf("data-cf-") === 0 && attr.name !== "data-cf-event") {
        params[attr.name.substring(8).replace(/-/g, "_")] = attr.value;
      }
    }
    if (el.tagName === "A" && el.href) params.link_url = el.href;
    var txt = (el.textContent || "").trim();
    if (txt) params.link_text = txt.slice(0, 80);
    try { window.gtag("event", name, params); } catch (err) {}
  });

  function start() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
      return;
    }
    if (!document.body || window.__instilligentAnalyticsInit) return;
    window.__instilligentAnalyticsInit = true;
    buildUi();
    if (storageGet() !== "granted") setDisabled(true);
    syncUi();
    if (storageGet() === "granted") loadGa();
    window.addEventListener("storage", onStorage);
  }

  start();
})();
