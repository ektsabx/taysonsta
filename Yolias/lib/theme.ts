// Theme preference (System / Light / Dark). Signed-in users keep it on their
// profile; the cookie carries it to public and sign-in pages too.
export type ThemePref = "system" | "light" | "dark";

export const THEME_COOKIE = "yolias_theme";

export function isThemePref(v: unknown): v is ThemePref {
  return v === "system" || v === "light" || v === "dark";
}

// Resolves "system" to light/dark before paint (no flash) and follows the OS
// when it changes.
export const themeScript = `(function(){try{var d=document.documentElement;var m=window.matchMedia('(prefers-color-scheme: dark)');var apply=function(){var p=d.getAttribute('data-theme-pref')||'system';d.setAttribute('data-theme',p==='system'?(m.matches?'dark':'light'):p);};apply();m.addEventListener('change',apply);}catch(e){}})();`;
