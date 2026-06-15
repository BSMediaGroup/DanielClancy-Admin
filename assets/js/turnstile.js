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
      tokenIssuedAt: 0,
      mountedElement: null,
      message: "Loading security check..."
    };
    const configUrl = options.configUrl;
    const onChange = typeof options.onChange === "function" ? options.onChange : function () {};

    function setToken(token, message) {
      state.token = token || "";
      state.tokenIssuedAt = state.token ? Date.now() : 0;
      state.message = message || "";
      onChange(state.token, state.message, state.tokenIssuedAt);
    }

    async function mount(element) {
      if (!element) return;
      if (state.widgetId && state.mountedElement === element) return;
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
        state.mountedElement = element;
        state.widgetId = window.turnstile.render(element, {
          sitekey: siteKey,
          callback: function (token) {
            setToken(token, "Security check complete.");
          },
          "expired-callback": function () {
            setToken("", "Security check expired. Please try again.");
          },
          "error-callback": function () {
            setToken("", "Security check failed. Retry.");
          }
        });
        setToken("", "Complete the security check to continue.");
      } catch (_error) {
        setToken("", "Turnstile unavailable in static dev.");
      }
    }

    function reset() {
      if (state.widgetId && window.turnstile) {
        window.turnstile.reset(state.widgetId);
      }
      setToken("", "Complete the security check to continue.");
    }

    function remove() {
      if (state.widgetId && window.turnstile) {
        window.turnstile.remove(state.widgetId);
      }
      state.widgetId = null;
      state.mountedElement = null;
      setToken("", "");
    }

    return {
      mount,
      reset,
      remove,
      getToken: function () {
        return state.token;
      },
      getTokenIssuedAt: function () {
        return state.tokenIssuedAt;
      }
    };
  }

  window.DCTurnstile = {
    create: createTurnstileController
  };
})();
