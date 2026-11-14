"use client";

import { useEffect } from "react";
import { THEME_COOKIE, THEME_STORAGE_KEY } from "../lib/theme";

function currentTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applySystem(media.matches);
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      aria-label="Switch between light and dark"
      onClick={() => applyTheme(currentTheme() === "dark" ? "light" : "dark")}
    >
      <span className="when-light">Dark</span>
      <span className="when-dark">Light</span>
    </button>
  );
}

function applySystem(dark: boolean) {
  const theme = dark ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}
