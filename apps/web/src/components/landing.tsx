"use client";

import Link from "next/link";
import { ArrowLeft, BookOpenText, Languages, Quote, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n";

export function Landing() {
  const t = useT();

  const features = [
    { icon: BookOpenText, title: t("landing.f1Title"), body: t("landing.f1Body") },
    { icon: Quote, title: t("landing.f2Title"), body: t("landing.f2Body") },
    { icon: Languages, title: t("landing.f3Title"), body: t("landing.f3Body") }
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <section className="flex flex-col items-center px-2 py-10 text-center sm:py-16">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-ink/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
          <Sparkles className="h-3.5 w-3.5 text-moss dark:text-sea" />
          {t("brand.org")}
        </span>

        <h1 className="mt-6 max-w-2xl text-3xl font-bold leading-snug tracking-tight text-ink dark:text-white sm:text-4xl">
          {t("landing.heroTitle")}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-ink/60 dark:text-white/60">{t("landing.heroSubtitle")}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-moss px-5 text-sm font-semibold text-white transition hover:bg-moss/90"
          >
            {t("landing.getStarted")}
            <ArrowLeft className="h-4 w-4 ltr:rotate-180" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:text-sea"
          >
            {t("nav.signin")}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 pb-6 sm:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="rounded-2xl border border-line bg-white p-5 dark:border-white/10 dark:bg-[#0c0c0e]"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3.5 text-sm font-semibold text-ink dark:text-white">{feature.title}</h3>
              <p className="mt-1 text-sm leading-6 text-ink/55 dark:text-white/55">{feature.body}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
