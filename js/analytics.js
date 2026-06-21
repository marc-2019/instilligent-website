/* GA4 + Klaro consent + Consent Mode v2
 * Replace GTM_ID below with the real container ID from GA4 admin once provisioned.
 * Vendor files: /js/klaro-no-css.js + /js/klaro.min.css (Klaro v0.7.21).
 */
(function () {
  var GA4_ID = "G-JCNLL09KHW"; // instilligent.com GA4 (wired 2026-06-22)
  var SITE_LABEL = "Instilligent";

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag("consent", "default", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500
  });

  // Load GA4 directly (we provisioned a GA4 property, not a GTM container).
  (function (d, s, i) {
    var f = d.getElementsByTagName(s)[0],
        j = d.createElement(s);
    j.async = true;
    j.src = "https://www.googletagmanager.com/gtag/js?id=" + i;
    f.parentNode.insertBefore(j, f);
  })(document, "script", GA4_ID);
  gtag("js", new Date());
  gtag("config", GA4_ID);

  window.klaroConfig = {
    version: 1,
    elementID: "klaro",
    storageMethod: "cookie",
    cookieName: "klaro",
    cookieExpiresAfterDays: 365,
    default: false,
    mustConsent: false,
    acceptAll: true,
    hideDeclineAll: false,
    htmlTexts: true,
    services: [
      {
        name: "google-analytics",
        title: "Google Analytics",
        description:
          "Anonymous analytics so we can understand which content visitors find useful on " +
          SITE_LABEL + ".",
        purposes: ["analytics"],
        cookies: [/^_ga/, /^_gid/, /^_gat/],
        onAccept:
          "gtag('consent','update',{analytics_storage:'granted'});",
        onDecline:
          "gtag('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});"
      }
    ],
    translations: {
      en: {
        consentNotice: {
          title: "Privacy preferences",
          description:
            "We use cookies to understand how visitors use our site. Choose your preferences below."
        },
        consentModal: {
          title: "Privacy preferences",
          description:
            "We use cookies for analytics. You can change these preferences at any time."
        },
        purposes: { analytics: "Analytics" }
      }
    }
  };

  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-cf-event]") : null;
    if (!el) return;
    var name = el.getAttribute("data-cf-event");
    if (!name) return;
    var params = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name.indexOf("data-cf-") === 0 && a.name !== "data-cf-event") {
        params[a.name.substring(8).replace(/-/g, "_")] = a.value;
      }
    }
    if (el.tagName === "A" && el.href) params.link_url = el.href;
    var txt = (el.textContent || "").trim();
    if (txt) params.link_text = txt.slice(0, 80);
    try { window.gtag && window.gtag("event", name, params); } catch (_) {}
  });
})();
