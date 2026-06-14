(function () {
  "use strict";

  const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  let scriptPromise = null;

  function loadScript() {
    if (window.turnstile) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-dc-turnstile]");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("Turnstile script failed to load.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.dataset.dcTurnstile = "true";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", () => reject(new Error("Turnstile script failed to load.")), { once: true });
      document.head.appendChild(script);
    });
    return scriptPromise;
  }

  function createTurnstileController(options) {
    const state = {
      widgetId: null,
      token: "",
      message: "Loading security check..."
    };
    const configUrl = options.configUrl;
    const actionLabel = options.actionLabel || "continue";
    const onChange = typeof options.onChange === "function" ? options.onChange : function () {};

    function setToken(token, message) {
      state.token = token || "";
      state.message = message || "";
      onChange(state.token, state.message);
    }

    async function mount(element) {
      if (!element) return;
      try {
        const response = await fetch(configUrl, { cache: "no-store", credentials: "include" });
        const config = await response.json().catch(() => null);
        const siteKey = String(config?.siteKey || "").trim();
        if (!siteKey) {
          setToken("", config?.message || "Turnstile unavailable in static dev.");
          return;
        }
        await loadScript();
        if (!window.turnstile) return;
        if (state.widgetId) {
          window.turnstile.remove(state.widgetId);
          state.widgetId = null;
        }
        element.innerHTML = "";
        state.widgetId = window.turnstile.render(element, {
          sitekey: siteKey,
          callback: function (token) {
            setToken(token, "Security check complete.");
          },
          "expired-callback": function () {
            setToken("", "Security check expired. Complete it again.");
          },
          "error-callback": function () {
            setToken("", "Security check failed to load. Refresh and try again.");
          }
        });
        setToken("", `Complete the security check to ${actionLabel}.`);
      } catch (_error) {
        setToken("", "Turnstile unavailable in static dev.");
      }
    }

    function reset() {
      if (state.widgetId && window.turnstile) {
        window.turnstile.reset(state.widgetId);
      }
      setToken("", `Complete the security check to ${actionLabel}.`);
    }

    function remove() {
      if (state.widgetId && window.turnstile) {
        window.turnstile.remove(state.widgetId);
      }
      state.widgetId = null;
      setToken("", "");
    }

    return {
      mount,
      reset,
      remove,
      getToken: function () {
        return state.token;
      }
    };
  }

  window.DCTurnstile = {
    create: createTurnstileController
  };
})();
