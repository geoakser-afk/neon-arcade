/* Arcade.auth — optional sign-in with Clerk. Nothing in the arcade REQUIRES an account except
   multiplayer ("Play Together"). Loads ClerkJS lazily from the Clerk app's frontend API, puts a
   Sign in / avatar button in the header, and exposes:
     Arcade.auth.ready        Promise that resolves once Clerk loaded (or failed → offline mode)
     Arcade.auth.available()  false over file:// or if ClerkJS failed to load
     Arcade.auth.isSignedIn() Arcade.auth.user() → {id, name, avatar}   Arcade.auth.token() → Promise<jwt|null>
     Arcade.auth.signIn()     opens Clerk's sign-in modal
     document event "arcade:auth" fires on every sign-in/out change. */
(function () {
  const A = (window.Arcade = window.Arcade || {});
  const PUBLISHABLE_KEY = "pk_test_cHJvLWVsZXBoYW50LTY2MTkuY2xlcmsuYWNjb3VudHMuZGV2JA";   // Clerk app "Neon Arcade" (dev instance)
  const FAPI = "pro-elephant-6619.clerk.accounts.dev";
  let clerk = null, available = false, listeners = [];
  const can = location.protocol === "http:" || location.protocol === "https:";

  function user() {
    const u = clerk && clerk.user; if (!u) return null;
    const name = u.username || u.firstName || (u.primaryEmailAddress && u.primaryEmailAddress.emailAddress.split("@")[0]) || "Frog";
    return { id: u.id, name: String(name).slice(0, 14), avatar: u.imageUrl || null };
  }
  function fire() { document.dispatchEvent(new CustomEvent("arcade:auth", { detail: { user: user() } })); }

  const ready = new Promise(function (resolve) {
    if (!can) { resolve(); return; }
    const s = document.createElement("script");
    s.async = true; s.crossOrigin = "anonymous";
    s.setAttribute("data-clerk-publishable-key", PUBLISHABLE_KEY);
    s.src = "https://" + FAPI + "/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
    s.onload = async function () {
      try {
        clerk = window.Clerk;
        await clerk.load({ appearance: { variables: { colorPrimary: "#7fe0a0", colorBackground: "#14112a", colorText: "#e6ecf5", colorInputBackground: "#0e0c1e", colorInputText: "#e6ecf5", borderRadius: "14px" } } });
        available = true;
        clerk.addListener(function () { fire(); });
      } catch (e) { console.warn("[arcade] Clerk failed to load — playing offline", e); available = false; }
      fire(); resolve();
    };
    s.onerror = function () { console.warn("[arcade] Clerk script blocked/offline — playing offline"); fire(); resolve(); };
    document.head.appendChild(s);
  });

  A.auth = {
    ready: ready,
    available: function () { return available; },
    isSignedIn: function () { return !!(clerk && clerk.user); },
    user: user,
    token: async function () { try { return clerk && clerk.session ? await clerk.session.getToken() : null; } catch (e) { return null; } },
    signIn: function () { if (!available) { alert("Sign-in isn't available right now (offline or blocked). You can still play everything single-player."); return; } clerk.openSignIn({}); },
    profile: function () { if (available && clerk.user) clerk.openUserProfile({}); },
    signOut: function () { if (available) clerk.signOut(); }
  };
})();
