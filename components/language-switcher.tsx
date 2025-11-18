"use client";

import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE } from "@/i18n/config";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STORAGE_KEY = "alma-language";

type LanguageSwitcherProps = {
  className?: string;
  variant?: "default" | "minimal";
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function LanguageSwitcher({ className = "", variant = "default" }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const showControls = variant === "default";

  const activeCode = useMemo(() => {
    const current = i18n.language?.split("-")[0]?.toLowerCase();
    if (!current) return DEFAULT_LANGUAGE;
    const match = AVAILABLE_LANGUAGES.find(
      (lang) => lang.code.toLowerCase() === current
    );
    return match?.code ?? DEFAULT_LANGUAGE;
  }, [i18n.language]);

  const updateScrollState = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const { scrollLeft, scrollWidth, clientWidth } = node;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  function handleChange(code: string) {
    if (code === activeCode) return;
    i18n.changeLanguage(code);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, code);
    }
  }

  const scrollByDelta = useCallback(
    (delta: number) => {
      const node = scrollRef.current;
      if (!node) return;
      const maxScroll = node.scrollWidth - node.clientWidth;
      const nextLeft = Math.min(
        Math.max(node.scrollLeft + delta, 0),
        Math.max(maxScroll, 0)
      );
      node.scrollTo({ left: nextLeft, behavior: "smooth" });
      requestAnimationFrame(updateScrollState);
    },
    [updateScrollState]
  );

  function handleScroll(action: "left" | "right") {
    const delta = action === "left" ? -180 : 180;
    scrollByDelta(delta);
  }

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    updateScrollState();
    node.addEventListener("scroll", updateScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(node);
    return () => {
      node.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeButton = container.querySelector<HTMLButtonElement>(
      'button[data-active="true"]'
    );
    if (!activeButton) return;
    const { offsetLeft, offsetWidth } = activeButton;
    const visibleStart = container.scrollLeft;
    const visibleEnd = visibleStart + container.clientWidth;
    const targetStart = offsetLeft;
    const targetEnd = offsetLeft + offsetWidth;
    if (targetStart < visibleStart) {
      container.scrollTo({ left: targetStart - 16, behavior: "smooth" });
    } else if (targetEnd > visibleEnd) {
      container.scrollTo({ left: targetEnd - container.clientWidth + 16, behavior: "smooth" });
    }
  }, [activeCode]);

  return (
    <div className={cx("w-full space-y-2 sm:w-auto", variant === "minimal" && "space-y-1 sm:max-w-sm", className)}>
      <span className="block w-full text-center text-[0.6rem] font-semibold uppercase tracking-[0.45em] text-slate-500/80 sm:text-left">
        {t("language.label")}
      </span>
      <div
        className={cx(
          "flex w-full items-center gap-2 sm:w-auto",
          variant === "minimal" &&
            "rounded-full border border-slate-200/60 bg-white/80 px-2 py-1 shadow-inner shadow-white"
        )}
      >
        {showControls && (
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-900 disabled:opacity-30"
            onClick={() => handleScroll("left")}
            disabled={!canScrollLeft}
            aria-label={t("language.scrollLeft")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <div
          className={cx(
            "relative w-full overflow-hidden",
            variant === "default" &&
              "rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm shadow-slate-200/60"
          )}
          aria-label={t("language.label")}
        >
          {variant === "default" && (
            <>
              <div className="pointer-events-none absolute inset-y-2 left-0 w-8 rounded-l-2xl bg-gradient-to-r from-white via-white/80 to-transparent"></div>
              <div className="pointer-events-none absolute inset-y-2 right-0 w-8 rounded-r-2xl bg-gradient-to-l from-white via-white/80 to-transparent"></div>
            </>
          )}
          <div
            ref={scrollRef}
            className={cx(
              "flex w-full gap-1 overflow-x-auto pr-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              variant === "minimal" && "pr-0"
            )}
          >
          {AVAILABLE_LANGUAGES.map((language) => {
            const isActive = activeCode === language.code;
            return (
              <button
                key={language.code}
                type="button"
                onClick={() => handleChange(language.code)}
                data-active={isActive}
                className={cx(
                  "shrink-0 whitespace-nowrap rounded-full px-3 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
                  variant === "minimal" && "text-[0.65rem] px-2",
                  "data-[active=true]:bg-slate-900 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-slate-900/15"
                )}
              >
                {language.label}
              </button>
            );
          })}
          </div>
        </div>
        {showControls && (
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-900 disabled:opacity-30"
            onClick={() => handleScroll("right")}
            disabled={!canScrollRight}
            aria-label={t("language.scrollRight")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
