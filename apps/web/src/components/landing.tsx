"use client";

import Link from "next/link";
import { ArrowLeft, BookOpenText, Languages, Quote } from "lucide-react";
import { BooksCarousel } from "@/components/books-carousel";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
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
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-ink/75 dark:border-white/10 dark:bg-white/5 dark:text-white/75">
          {t("brand.org")}
        </span>

        <h1 className="mt-6 max-w-2xl font-display text-3xl font-bold leading-tight text-ink dark:text-white sm:text-4xl">
          {t("landing.heroTitle")}
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-ink/75 dark:text-white/75">{t("landing.heroSubtitle")}</p>

        <div className="mt-8 flex w-full max-w-xs flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
          <Link href="/register" className={buttonClass("primary")}>
            {t("landing.getStarted")}
            <ArrowLeft className="h-4 w-4 ltr:rotate-180" />
          </Link>
          <Link href="/login" className={buttonClass("secondary")}>
            {t("nav.signin")}
          </Link>
          <Link href="/library" className={buttonClass("secondary")}>
            {t("nav.library")}
          </Link>
        </div>
      </section>

      <BooksCarousel />

      <section className="grid gap-4 pb-6 sm:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title}>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-ink dark:text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink/75 dark:text-white/75">{feature.body}</p>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
