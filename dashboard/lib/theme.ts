export const THEME_STORAGE_KEY = "fdc-theme";
export const THEME_COOKIE = "fdc_theme";

/** Runs before paint so a saved theme does not flash the other way. */
export const themeBootScript = `(function(){try{var stored=localStorage.getItem("${THEME_STORAGE_KEY}");var fromStore=stored==="light"||stored==="dark";var theme=fromStore?stored:null;if(!theme){var match=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);theme=match?match[1]:null;}if(!theme){theme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var root=document.documentElement;root.setAttribute("data-theme",theme);root.style.colorScheme=theme;if(fromStore){var current=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);if(!current||current[1]!==stored){document.cookie="${THEME_COOKIE}="+stored+"; Path=/; Max-Age=31536000; SameSite=Lax";}}}catch(e){}})();`;
