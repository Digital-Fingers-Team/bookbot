"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

const STORAGE_KEY = "bookbot-lang";
const DEFAULT_LANG: Lang = "ar";

// All user-facing UI copy. Arabic is the default for ARADO; English is a switch.
export const STRINGS = {
  // Brand
  "brand.org": { ar: "المنظمة العربية للتنمية الإدارية", en: "Arab Administrative Development Organization" },
  "brand.orgShort": { ar: "المنظمة العربية للتنمية الإدارية", en: "ARADO" },
  "brand.tagline": { ar: "إجابات موثّقة من مكتبتك", en: "Cited answers from your library" },
  "brand.workspace": { ar: "منصّة المعرفة", en: "Knowledge workspace" },

  // Nav
  "nav.ask": { ar: "اسأل الكتب", en: "Ask Books" },
  "nav.library": { ar: "المكتبة", en: "Library" },
  "nav.upload": { ar: "رفع كتاب", en: "Upload" },
  "nav.signin": { ar: "تسجيل الدخول", en: "Sign in" },
  "nav.create": { ar: "إنشاء حساب", en: "Create account" },
  "nav.loadingAccount": { ar: "جارٍ تحميل الحساب…", en: "Loading account…" },
  "nav.appearance": { ar: "المظهر", en: "Appearance" },
  "nav.language": { ar: "اللغة", en: "Language" },
  "nav.profileSettings": { ar: "إعدادات الحساب", en: "Profile settings" },
  "role.admin": { ar: "مدير", en: "admin" },
  "role.user": { ar: "مستخدم", en: "user" },

  // Footer
  "footer.rights": { ar: "جميع الحقوق محفوظة", en: "All rights reserved" },
  "footer.poweredBy": { ar: "منصة معرفية مدعومة بالذكاء الاصطناعي", en: "AI-powered knowledge platform" },

  // Ask page
  "ask.title": { ar: "اسأل كتبك", en: "Ask your books" },
  "ask.subtitle": { ar: "إجابات من مكتبتك فقط", en: "Grounded only in your library" },
  "ask.newChat": { ar: "محادثة جديدة", en: "New chat" },
  "ask.emptyTitle": { ar: "اسأل مكتبتك عن أي شيء", en: "Ask your library anything" },
  "ask.emptyBody": {
    ar: "يبحث النظام في كتبك المرفوعة، ويعرض الأدلة المطابقة، ويجيب فقط مما يجده.",
    en: "The system searches your uploaded books, shows the matching evidence, and answers only from what it finds."
  },
  "ask.searching": { ar: "جارٍ البحث في كتبك", en: "Searching your books" },
  "ask.evidence": { ar: "الأدلة", en: "Evidence" },
  "ask.rawChunks": { ar: "المقاطع المسترجَعة", en: "Raw retrieved chunks" },
  "ask.page": { ar: "صفحة", en: "Page" },
  "ask.match": { ar: "تطابق", en: "match" },
  "ask.chunks": { ar: "مقطع", en: "chunks" },
  "ask.copy": { ar: "نسخ", en: "Copy" },
  "ask.copied": { ar: "تم النسخ", en: "Copied" },
  "ask.open": { ar: "فتح", en: "Open" },
  "ask.openAtPage": { ar: "افتح عند الصفحة", en: "Open at page" },
  "ask.openedAtPage": { ar: "مفتوح عند الصفحة", en: "Opened at page" },
  "ask.openFailed": { ar: "تعذّر فتح هذا الكتاب.", en: "Could not open this book." },
  "ask.opening": { ar: "جارٍ فتح الكتاب…", en: "Opening book…" },
  "ask.closeReader": { ar: "إغلاق القارئ", en: "Close reader" },
  "ask.helpful": { ar: "هل كانت الإجابة مفيدة؟", en: "Was this helpful?" },
  "ask.feedbackThanks": { ar: "شكرًا لملاحظتك", en: "Thanks for your feedback" },
  "ask.print": { ar: "طباعة / حفظ PDF", en: "Print / save PDF" },
  "ask.placeholder": {
    ar: "اسأل عن معلومة أو صفحة أو موضوع أو اسم أو اقتباس…",
    en: "Ask about a fact, page, topic, name, or quote…"
  },
  "ask.enterToSend": { ar: "للإرسال", en: "to send" },
  "ask.shiftEnter": { ar: "لسطر جديد", en: "for a new line" },
  "ask.depth": { ar: "العمق", en: "Depth" },
  "ask.history": { ar: "سجل المحادثات", en: "History" },
  "ask.noHistory": { ar: "لا توجد محادثات محفوظة بعد", en: "No saved conversations yet" },
  "ask.deleteChat": { ar: "حذف المحادثة", en: "Delete conversation" },
  "ask.deleteChatConfirm": { ar: "حذف هذه المحادثة؟", en: "Delete this conversation?" },

  // Library
  "lib.title": { ar: "المكتبة", en: "Library" },
  "lib.subtitle": { ar: "إدارة كتبك المرفوعة", en: "Manage your uploaded books" },
  "lib.refresh": { ar: "تحديث", en: "Refresh" },
  "lib.upload": { ar: "رفع", en: "Upload" },
  "lib.loadingBooks": { ar: "جارٍ تحميل كتبك…", en: "Loading your books…" },
  "lib.statBooks": { ar: "كتب", en: "books" },
  "lib.statPages": { ar: "صفحة", en: "pages" },
  "lib.statChunks": { ar: "مقطع قابل للبحث", en: "searchable chunks" },
  "lib.searchPlaceholder": { ar: "ابحث بالعنوان أو اسم الملف أو المؤلف…", en: "Search by title, file name, or author…" },
  "lib.sortNewest": { ar: "الأحدث أولًا", en: "Newest first" },
  "lib.sortTitle": { ar: "العنوان أ–ي", en: "Title A–Z" },
  "lib.sortPages": { ar: "الأكثر صفحات", en: "Most pages" },
  "lib.sortChunks": { ar: "الأكثر مقاطع", en: "Most chunks" },
  "lib.statusAll": { ar: "الكل", en: "All" },
  "lib.statusReady": { ar: "جاهز", en: "Ready" },
  "lib.statusProcessing": { ar: "قيد المعالجة", en: "Processing" },
  "lib.statusFailed": { ar: "فشل", en: "Failed" },
  "lib.showing": { ar: "عرض", en: "Showing" },
  "lib.of": { ar: "من", en: "of" },
  "lib.pages": { ar: "صفحة", en: "pages" },
  "lib.chunks": { ar: "مقطع", en: "chunks" },
  "lib.openBook": { ar: "فتح", en: "Open" },
  "lib.category": { ar: "التصنيف", en: "Category" },
  "lib.allCategories": { ar: "كل التصنيفات", en: "All categories" },
  "lib.uncategorized": { ar: "غير مصنّف", en: "Uncategorized" },
  "lib.addCategory": { ar: "إضافة تصنيف", en: "Add category" },
  "lib.categoryPrompt": { ar: "أدخل التصنيف (اتركه فارغًا للإزالة):", en: "Enter a category (leave empty to remove):" },
  "lib.previewFallback": {
    ar: "ستظهر معاينة الصفحة الأولى هنا بعد استخراج النص.",
    en: "First page preview appears here after text is extracted."
  },
  "lib.failedBadge": { ar: "فشلت المعالجة — احذف وأعد الرفع", en: "Failed — delete & re-upload" },
  "lib.failedShort": { ar: "فشل", en: "Failed" },
  "lib.processingShort": { ar: "قيد المعالجة", en: "Processing" },
  "lib.ready": { ar: "جاهز", en: "Ready" },
  "lib.processingOf": { ar: "معالجة", en: "Processing" },
  "lib.noMatchTitle": { ar: "لا توجد كتب مطابقة لبحثك", en: "No books match your filters" },
  "lib.noMatchBody": { ar: "جرّب بحثًا أو حالة مختلفة.", en: "Try a different search or status." },
  "lib.clearFilters": { ar: "مسح عوامل التصفية", en: "Clear filters" },
  "lib.noBooksTitle": { ar: "لا توجد كتب بعد", en: "No books yet" },
  "lib.noBooksAdmin": {
    ar: "ارفع ملف PDF لبدء بناء قاعدة معرفتك القابلة للبحث.",
    en: "Upload a PDF to start building your searchable knowledge base."
  },
  "lib.noBooksUser": {
    ar: "بمجرد أن يرفع المدير كتبًا، ستظهر هنا للبحث.",
    en: "Once an admin uploads books, they'll appear here for you to search."
  },
  "lib.uploadFirst": { ar: "ارفع كتابك الأول", en: "Upload your first book" },
  "lib.loadError": { ar: "تعذّر تحميل المكتبة.", en: "Could not load the library." },
  "lib.deleteError": { ar: "تعذّر حذف هذا الكتاب.", en: "Could not delete this book." },
  "lib.deleteConfirm": { ar: "حذف هذا الكتاب وكل مقاطعه؟", en: "Delete this book and all of its chunks?" },
  "lib.checkingSession": { ar: "جارٍ التحقق من جلستك…", en: "Checking your session…" },
  "lib.redirecting": { ar: "جارٍ التحويل لتسجيل الدخول…", en: "Redirecting to sign in…" },

  // Upload
  "up.title": { ar: "أضف إلى مكتبتك", en: "Add to your library" },
  "up.subtitle": {
    ar: "اسحب ملفات PDF وسيستخرج النظام النص، ويقسّم كل كتاب إلى مقاطع قابلة للبحث، ويحفظ كل صفحة مصدرًا للاستشهاد.",
    en: "Drop in PDFs and the system extracts the text, splits each book into searchable chunks, and keeps every source page for citations."
  },
  "up.dropHere": { ar: "اسحب وأفلت ملفات PDF هنا", en: "Drag & drop PDFs here" },
  "up.dropNow": { ar: "أفلت للإضافة", en: "Drop to add" },
  "up.browse": { ar: "تصفّح ملفاتك", en: "browse your files" },
  "up.orBrowse": { ar: "أو", en: "or" },
  "up.textBest": { ar: "ملفات PDF النصية أفضل للاستشهاد بالصفحات", en: "text-based PDFs cite best" },
  "up.ready": { ar: "جاهز", en: "ready" },
  "up.book": { ar: "كتاب", en: "book" },
  "up.books": { ar: "كتب", en: "books" },
  "up.separateBooks": { ar: "يُضاف كل ملف ككتاب منفصل", en: "added as separate books" },
  "up.process": { ar: "معالجة", en: "Process" },
  "up.processing": { ar: "جارٍ المعالجة…", en: "Processing…" },
  "up.queued": { ar: "تمت إضافة الكتب للمعالجة", en: "Queued books for processing" },
  "up.trackProgress": { ar: "تابع التقدّم في المكتبة", en: "Track progress in the Library" },
  "up.uploadFailed": { ar: "فشل الرفع. حاول مرة أخرى.", en: "Upload failed. Please try again." },
  "up.notPdf": { ar: "ليس ملف PDF.", en: "is not a PDF file." },
  "up.infoSplitTitle": { ar: "تقسيم بالصفحات", en: "Split by page" },
  "up.infoSplitBody": { ar: "يُقسّم كل ملف مع حفظ صفحته المصدر للاستشهاد.", en: "Each PDF is chunked with its source page kept for citations." },
  "up.infoOcrTitle": { ar: "تعرّف ضوئي احتياطي", en: "OCR fallback" },
  "up.infoOcrBody": { ar: "تُقرأ الصفحات الممسوحة ضوئيًا تلقائيًا بالـ OCR.", en: "Scanned or image-only pages are read with OCR automatically." },
  "up.infoPrivacyTitle": { ar: "الخصوصية", en: "Privacy" },
  "up.infoPrivacyBody": { ar: "لا يغادر الكتاب كاملًا مخزنك — تصل المقاطع المطابقة فقط إلى الذكاء الاصطناعي.", en: "The full book never leaves your store — only matched chunks reach the AI." },
  "up.adminsOnly": { ar: "للمديرين فقط", en: "Admins only" },
  "up.adminsBody": {
    ar: "يمكنك طرح الأسئلة وتصفّح المكتبة، لكن رفع الكتب يحتاج حساب مدير.",
    en: "You can ask questions and browse the library, but uploading books needs an admin account."
  },
  "up.signinAdmin": { ar: "سجّل الدخول كمدير", en: "Sign in as admin" },
  "up.backToChat": { ar: "العودة للمحادثة", en: "Back to chat" },
  "up.checkingAccess": { ar: "جارٍ التحقق من صلاحية المدير…", en: "Checking admin access…" },

  // Settings
  "set.title": { ar: "الإعدادات", en: "Settings" },
  "set.subtitle": { ar: "إدارة ملفك الشخصي واللغة وكلمة المرور.", en: "Manage your profile, language, and password." },
  "set.logout": { ar: "تسجيل الخروج", en: "Log out" },
  "set.profile": { ar: "الملف الشخصي", en: "Profile" },
  "set.profileDesc": { ar: "اسم العرض ولغة الإجابات.", en: "Your display name and answer language." },
  "set.name": { ar: "الاسم", en: "Name" },
  "set.langField": { ar: "اللغة", en: "Language" },
  "set.english": { ar: "الإنجليزية", en: "English" },
  "set.arabic": { ar: "العربية", en: "Arabic" },
  "set.save": { ar: "حفظ التغييرات", en: "Save changes" },
  "set.password": { ar: "كلمة المرور", en: "Password" },
  "set.passwordDesc": { ar: "استخدم 6 أحرف على الأقل.", en: "Use at least 6 characters." },
  "set.currentPassword": { ar: "كلمة المرور الحالية", en: "Current password" },
  "set.newPassword": { ar: "كلمة المرور الجديدة", en: "New password" },
  "set.updatePassword": { ar: "تحديث كلمة المرور", en: "Update password" },
  "set.profileUpdated": { ar: "تم تحديث الملف الشخصي.", en: "Profile updated." },
  "set.passwordChanged": { ar: "تم تغيير كلمة المرور.", en: "Password changed." },
  "set.profileError": { ar: "تعذّر تحديث ملفك الشخصي.", en: "Could not update your profile." },
  "set.passwordError": { ar: "تعذّر تغيير كلمة المرور.", en: "Could not change your password." },
  "set.loadingProfile": { ar: "جارٍ تحميل الملف الشخصي…", en: "Loading profile…" },

  // Auth
  "auth.welcomeBack": { ar: "مرحبًا بعودتك", en: "Welcome back" },
  "auth.signinSubtitle": { ar: "سجّل الدخول للسؤال عن مكتبتك وعرض كتبك.", en: "Sign in to ask your library and view your books." },
  "auth.createTitle": { ar: "أنشئ حسابك", en: "Create your account" },
  "auth.createSubtitle": { ar: "ابدأ بطرح أسئلة مبنية على مكتبتك.", en: "Start asking questions grounded in your own library." },
  "auth.email": { ar: "البريد الإلكتروني", en: "Email" },
  "auth.password": { ar: "كلمة المرور", en: "Password" },
  "auth.name": { ar: "الاسم", en: "Name" },
  "auth.namePlaceholder": { ar: "اسمك", en: "Your name" },
  "auth.passwordHint": { ar: "6 أحرف على الأقل", en: "At least 6 characters" },
  "auth.signin": { ar: "تسجيل الدخول", en: "Sign in" },
  "auth.create": { ar: "إنشاء حساب", en: "Create account" },
  "auth.needAccount": { ar: "تحتاج حسابًا؟", en: "Need an account?" },
  "auth.createOne": { ar: "أنشئ حسابًا", en: "Create one" },
  "auth.haveAccount": { ar: "لديك حساب بالفعل؟", en: "Already have an account?" },
  "auth.showPassword": { ar: "إظهار كلمة المرور", en: "Show password" },
  "auth.hidePassword": { ar: "إخفاء كلمة المرور", en: "Hide password" },
  "auth.signinError": { ar: "تعذّر تسجيل الدخول. حاول مرة أخرى.", en: "Could not sign in. Please try again." },
  "auth.createError": { ar: "تعذّر إنشاء الحساب. حاول مرة أخرى.", en: "Could not create the account. Please try again." },
  "auth.loadingSignin": { ar: "جارٍ تحميل تسجيل الدخول…", en: "Loading sign in…" },

  // Landing
  "landing.heroTitle": { ar: "اسأل مكتبتك، واحصل على إجابات موثّقة", en: "Ask your library, get cited answers" },
  "landing.heroSubtitle": {
    ar: "منصّة معرفية تبحث في كتب المنظمة المرفوعة، وتُجيب فقط بما تجده، مع عرض المصدر والصفحة لكل معلومة.",
    en: "A knowledge platform that searches the organization's uploaded books and answers only from what it finds — with the source and page for every fact."
  },
  "landing.getStarted": { ar: "ابدأ الآن", en: "Get started" },
  "landing.f1Title": { ar: "إجابات من كتبك فقط", en: "Answers from your books only" },
  "landing.f1Body": {
    ar: "لا تخمين ولا معلومات خارجية — كل إجابة مبنية على مكتبتك.",
    en: "No guessing, no outside knowledge — every answer is grounded in your library."
  },
  "landing.f2Title": { ar: "أدلة قابلة للتحقق", en: "Verifiable evidence" },
  "landing.f2Body": {
    ar: "اطّلع على المقاطع الداعمة وافتح الكتاب عند الصفحة الصحيحة بنقرة.",
    en: "See the supporting passages and open the book at the exact page in one click."
  },
  "landing.f3Title": { ar: "عربي بالكامل", en: "Fully Arabic" },
  "landing.f3Body": {
    ar: "واجهة عربية من اليمين إلى اليسار، مع دعم الإنجليزية عند الحاجة.",
    en: "A right-to-left Arabic interface, with English available when needed."
  },

  // Analytics
  "nav.analytics": { ar: "التحليلات", en: "Analytics" },
  "an.title": { ar: "لوحة التحليلات", en: "Analytics" },
  "an.subtitle": { ar: "نظرة عامة على المكتبة والاستخدام.", en: "An overview of your library and usage." },
  "an.library": { ar: "المكتبة", en: "Library" },
  "an.books": { ar: "الكتب", en: "Books" },
  "an.pages": { ar: "الصفحات", en: "Pages" },
  "an.chunks": { ar: "المقاطع", en: "Chunks" },
  "an.activity": { ar: "النشاط", en: "Activity" },
  "an.chatRequests": { ar: "أسئلة المحادثة", en: "Chat requests" },
  "an.uploads": { ar: "عمليات الرفع", en: "Uploads" },
  "an.successful": { ar: "ناجحة", en: "successful" },
  "an.failed": { ar: "فاشلة", en: "failed" },
  "an.totalTokens": { ar: "إجمالي الرموز", en: "Total tokens" },
  "an.tokensNote": { ar: "إجمالي الرموز المعالَجة عبر مزوّد الذكاء الاصطناعي.", en: "Total tokens processed by the AI provider." },
  "an.adminOnly": { ar: "هذه الصفحة للمديرين فقط.", en: "This page is for admins only." },
  "an.loading": { ar: "جارٍ تحميل التحليلات…", en: "Loading analytics…" },
  "an.loadError": { ar: "تعذّر تحميل التحليلات.", en: "Could not load analytics." }
} as const;

export type StringKey = keyof typeof STRINGS;

type LangContextValue = {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (lang: Lang) => void;
  t: (key: StringKey) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Lang | null) ?? DEFAULT_LANG;
    setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      setLang: setLangState,
      t: (key: StringKey) => STRINGS[key]?.[lang] ?? key
    }),
    [lang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const context = useContext(LangContext);
  if (!context) {
    // Fallback so components can render outside the provider (e.g. tests).
    return {
      lang: DEFAULT_LANG,
      dir: "rtl" as const,
      setLang: () => undefined,
      t: (key: StringKey) => STRINGS[key]?.[DEFAULT_LANG] ?? key
    };
  }
  return context;
}

export function useT() {
  return useLang().t;
}
