"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

const STORAGE_KEY = "bookbot-lang";
const DEFAULT_LANG: Lang = "ar";
export const AI_NAME = "zaky";

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
  "nav.skipToContent": { ar: "تخطّي إلى المحتوى", en: "Skip to content" },
  "nav.adminSection": { ar: "الإدارة", en: "Admin" },
  "nav.newDecisions": { ar: "قرارات جديدة على طلباتك", en: "new decisions on your requests" },
  "nav.menu": { ar: "القائمة", en: "Menu" },
  "nav.openMenu": { ar: "فتح القائمة", en: "Open menu" },
  "nav.closeMenu": { ar: "إغلاق القائمة", en: "Close menu" },
  "role.admin": { ar: "مدير", en: "admin" },
  "role.orgAdmin": { ar: "مدير جامعة", en: "org admin" },
  "role.user": { ar: "مستخدم", en: "user" },

  // Footer
  "footer.rights": { ar: "جميع الحقوق محفوظة", en: "All rights reserved" },
  "footer.poweredBy": { ar: "منصة معرفية مدعومة بالذكاء الاصطناعي", en: "AI-powered knowledge platform" },

  // Ask page
  "ask.title": { ar: "اسأل زكي", en: "Ask zaky" },
  "ask.subtitle": { ar: "إجابات من مكتبتك فقط", en: "Grounded only in your library" },
  "ask.newChat": { ar: "محادثة جديدة", en: "New chat" },
  "ask.emptyTitle": { ar: "اسأل زكي عن أي شيء", en: "Ask zaky anything" },
  "ask.emptyBody": {
    ar: "يبحث النظام في كتبك المرفوعة، ويعرض الأدلة المطابقة، ويجيب فقط مما يجده.",
    en: "The system searches your uploaded books, shows the matching evidence, and answers only from what it finds."
  },
  "ask.searching": { ar: "جارٍ البحث في كتبك", en: "Searching your books" },
  "ask.expandOutsideBook": { ar: "وسّع الإجابة خارج الكتاب", en: "Expand beyond this book" },
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
  "ask.reportPlaceholder": { ar: "ما المشكلة؟ (اختياري)", en: "What went wrong? (optional)" },
  "ask.send": { ar: "إرسال", en: "Send" },
  "ask.print": { ar: "طباعة / حفظ PDF", en: "Print / save PDF" },
  "ask.placeholder": {
    ar: "اسأل عن معلومة أو صفحة أو موضوع أو اسم أو اقتباس…",
    en: "Ask about a fact, page, topic, name, or quote…"
  },
  "ask.enterToSend": { ar: "للإرسال", en: "to send" },
  "ask.shiftEnter": { ar: "لسطر جديد", en: "for a new line" },
  "ask.depth": { ar: "العمق", en: "Depth" },
  "ask.allBooks": { ar: "كل الكتب", en: "All books" },
  "ask.scope": { ar: "النطاق", en: "Scope" },
  "ask.howTitle": { ar: "كيف يعمل؟", en: "How it works" },
  "ask.gotIt": { ar: "تمام", en: "Got it" },
  "ask.howStep1": { ar: "اكتب سؤالك بالعربية أو الإنجليزية.", en: "Type your question in Arabic or English." },
  "ask.howStep2": {
    ar: "نبحث في كتب المنظمة المرفوعة عن أكثر المقاطع صلة بسؤالك.",
    en: "We search the organization's uploaded books for the passages most relevant to your question."
  },
  "ask.howStep3": {
    ar: "نجيب فقط بما نجده في الكتب، مع تظليل النص الذي استند إليه الجواب.",
    en: "We answer only from what we find, highlighting the text the answer relied on."
  },
  "ask.howStep4": {
    ar: "انقر أي مصدر لفتح الكتاب عند الصفحة، أو اطبع الإجابة مع مصادرها.",
    en: "Click any source to open the book at that page, or print the answer with its sources."
  },
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
  "lib.deleteFailed": { ar: "حذف الكتب الفاشلة", en: "Delete failed" },
  "lib.retryFailed": { ar: "إعادة معالجة الفاشلة", en: "Retry failed" },
  "lib.retryingFailed": { ar: "جارٍ إعادة المعالجة…", en: "Retrying…" },
  "lib.retryFailedError": {
    ar: "تعذّرت إعادة معالجة الكتب الفاشلة. حاول مرة أخرى.",
    en: "The failed books could not be re-queued. Please try again."
  },
  "lib.deletingFailed": { ar: "جارٍ الحذف…", en: "Deleting…" },
  "lib.deleteFailedError": {
    ar: "تعذّر حذف الكتب الفاشلة. حاول مرة أخرى.",
    en: "The failed books could not be deleted. Please try again."
  },
  "lib.showing": { ar: "عرض", en: "Showing" },
  "lib.of": { ar: "من", en: "of" },
  "lib.pages": { ar: "صفحة", en: "pages" },
  "lib.chunks": { ar: "مقطع", en: "chunks" },
  "lib.openBook": { ar: "فتح", en: "Open" },
  "lib.locked": { ar: "غير متاح", en: "Locked" },
  "lib.lockedHint": { ar: "اطلب الوصول لقراءته", en: "Request access to read" },
  "lib.category": { ar: "التصنيف", en: "Category" },
  "lib.allCategories": { ar: "كل التصنيفات", en: "All categories" },
  "lib.uncategorized": { ar: "غير ذلك", en: "Other" },
  "lib.newCategory": { ar: "تصنيف جديد…", en: "New category…" },
  "lib.add": { ar: "إضافة", en: "Add" },
  "lib.addCategory": { ar: "إضافة تصنيف", en: "Add category" },
  "lib.featureHome": { ar: "تمييز للرئيسية", en: "Feature on home" },
  "lib.featured": { ar: "مميّز", en: "Featured" },
  "lib.addDescription": { ar: "إضافة وصف", en: "Add description" },
  "lib.descriptionPrompt": { ar: "اكتب وصفاً مختصراً للكتاب (يُستخدم في الترشيحات):", en: "Write a short book description (used for recommendations):" },
  "lib.categoryPrompt": { ar: "أدخل التصنيف (اتركه فارغًا للإزالة):", en: "Enter a category (leave empty to remove):" },
  "lib.author": { ar: "المؤلف", en: "Author" },
  "lib.addAuthor": { ar: "إضافة مؤلف", en: "Add author" },
  "lib.authorPrompt": { ar: "أدخل اسم المؤلف (اتركه فارغًا للإزالة):", en: "Enter the author (leave empty to remove):" },
  "lib.uploaded": { ar: "الرفع", en: "Uploaded" },
  "lib.activated": { ar: "التفعيل", en: "Activated" },
  "lib.price": { ar: "السعر", en: "Price" },
  "lib.free": { ar: "مجاني", en: "Free" },
  "lib.setPrice": { ar: "تحديد السعر", en: "Set price" },
  "lib.pricePrompt": { ar: "أدخل سعر الكتاب (0 = مجاني):", en: "Enter the book price (0 = free):" },
  "lib.description": { ar: "الوصف", en: "Description" },
  "lib.save": { ar: "حفظ", en: "Save" },
  "lib.cancel": { ar: "إلغاء", en: "Cancel" },
  "common.currency": { ar: "ج.م", en: "EGP" },
  "common.loadMore": { ar: "تحميل المزيد", en: "Load more" },

  // My Books
  "nav.myBooks": { ar: "كتبي", en: "My Books" },
  "mb.title": { ar: "كتبي", en: "My Books" },
  "mb.subtitle": { ar: "كتبك التي اشتركت بها، والمفضّلة وما تتابع قراءته.", en: "Your purchased books, favorites, and what you're reading." },
  "mb.owned": { ar: "كتبي المتاحة", en: "My library" },
  "mb.continueReading": { ar: "متابعة القراءة", en: "Continue reading" },
  "mb.favorites": { ar: "المفضّلة", en: "Favorites" },
  "mb.empty": { ar: "لم تفتح أي كتاب بعد.", en: "You haven't opened any book yet." },
  "mb.noFavorites": { ar: "لا توجد كتب مفضّلة بعد.", en: "No favorite books yet." },
  "mb.browseLibrary": { ar: "تصفّح المكتبة", en: "Browse the library" },
  "mb.continue": { ar: "متابعة", en: "Continue" },
  "mb.read": { ar: "قراءة", en: "Read" },

  // Reading view
  "read.back": { ar: "رجوع", en: "Back" },
  "read.favorite": { ar: "أضف للمفضّلة", en: "Add to favorites" },
  "read.unfavorite": { ar: "إزالة من المفضّلة", en: "Remove from favorites" },
  "read.book": { ar: "الكتاب", en: "Book" },
  "audio.summaryTitle": { ar: "ملخّص الكتاب", en: "Book summary" },
  "audio.summarySubtitle": { ar: "استمع أثناء القراءة", en: "Listen while you read" },
  "audio.play": { ar: "تشغيل", en: "Play" },
  "audio.pause": { ar: "إيقاف مؤقّت", en: "Pause" },
  "audio.mute": { ar: "كتم الصوت", en: "Mute" },
  "audio.unmute": { ar: "إلغاء الكتم", en: "Unmute" },
  "audio.seek": { ar: "الانتقال في المقطع", en: "Seek" },
  "audio.loading": { ar: "جارٍ التحميل…", en: "Loading…" },
  "audio.error": { ar: "تعذّر تشغيل الملخّص الصوتي.", en: "Could not play the summary audio." },
  "read.assistant": { ar: "المساعد", en: "Assistant" },
  "read.askTitle": { ar: "اسأل عن هذا الكتاب", en: "Ask about this book" },
  "read.askPlaceholder": { ar: "اسأل عن أي شيء في هذا الكتاب…", en: "Ask anything about this book…" },
  "read.askEmpty": {
    ar: "اطرح سؤالاً وسنجيب من هذا الكتاب فقط، مع روابط تنقلك للصفحة.",
    en: "Ask a question and we'll answer from this book only, with links that jump to the page."
  },
  "read.opening": { ar: "جارٍ فتح الكتاب…", en: "Opening book…" },
  "read.notFound": { ar: "تعذّر فتح هذا الكتاب.", en: "Could not open this book." },
  "read.goToPage": { ar: "اذهب للصفحة", en: "Go to page" },
  "read.fitPage": { ar: "ملء الصفحة", en: "Fit page" },
  "read.fitWidth": { ar: "ملء العرض", en: "Fit width" },
  "read.downloadDisabled": { ar: "التحميل غير مفعّل لهذا الكتاب من قِبل الإدارة.", en: "Downloading this book has not been enabled by an admin." },
  "read.clearChat": { ar: "مسح", en: "Clear" },
  "lib.previewFallback": {
    ar: "ستظهر معاينة الصفحة الأولى هنا بعد استخراج النص.",
    en: "First page preview appears here after text is extracted."
  },
  "lib.failedBadge": { ar: "فشلت المعالجة — احذف وأعد الرفع", en: "Failed — delete & re-upload" },
  "lib.failedShort": { ar: "فشل", en: "Failed" },
  "lib.processingShort": { ar: "قيد المعالجة", en: "Processing" },
  "lib.ready": { ar: "جاهز", en: "Ready" },
  "lib.processingOf": { ar: "معالجة", en: "Processing" },
  "lib.cancelled": { ar: "تم الإلغاء", en: "Cancelled" },
  "lib.cancelledShort": { ar: "ملغى", en: "Cancelled" },
  "lib.cancelProcessingPrompt": { ar: "إلغاء معالجة هذا الكتاب؟", en: "Cancel processing for this book?" },
  "lib.cancelProcessing": { ar: "إلغاء معالجة الكتاب", en: "Cancel book processing" },
  "lib.cancelError": { ar: "تعذر إلغاء المعالجة.", en: "Could not cancel processing." },
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
  "lib.delete": { ar: "حذف", en: "Delete" },
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
  "up.price": { ar: "السعر", en: "Price" },
  "up.autoCategory": { ar: "تصنيف تلقائي بالذكاء الاصطناعي", en: "Categorise with AI" },
  "up.autoCategoryHint": {
    ar: "يختار الذكاء الاصطناعي تصنيفًا لكل كتاب بعد قراءة نصه",
    en: "The AI picks a category for each book after reading its text"
  },
  "up.priceHint": { ar: "يُطبَّق على كل الملفات في هذه الدفعة (0 = مجاني)", en: "Applied to every file in this batch (0 = free)" },
  "up.process": { ar: "معالجة", en: "Process" },
  "up.processing": { ar: "جارٍ المعالجة…", en: "Processing…" },
  "up.queued": { ar: "تمت إضافة الكتب للمعالجة", en: "Queued books for processing" },
  "up.trackProgress": { ar: "تابع التقدّم في المكتبة", en: "Track progress in the Library" },
  "up.uploadFailed": { ar: "فشل الرفع. حاول مرة أخرى.", en: "Upload failed. Please try again." },
  "up.notPdf": {
    ar: "نوع ملف غير مدعوم. يُرجى رفع PDF أو EPUB أو DOCX أو TXT.",
    en: "is not a supported file type. Please upload PDF, EPUB, DOCX, or TXT."
  },
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

  // Publishing (OMP)
  "omp.title": { ar: "النشر مع آرادو", en: "Publish with Arado" },
  "omp.desc": { ar: "قدّم كتابك للنشر وتابع دورة المراجعة والتحرير.", en: "Submit your book for publishing and track the review & editing cycle." },
  "omp.enter": { ar: "ادخل على منصة النشر", en: "Open publishing platform" },
  "omp.publishBook": { ar: "انشر كتاب", en: "Publish a book" },
  "omp.opening": { ar: "جارٍ الفتح…", en: "Opening…" },
  "omp.openError": { ar: "تعذّر فتح منصة النشر. حاول مرة أخرى.", en: "Could not open the publishing platform. Please try again." },

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
  "landing.libraryTitle": { ar: "من المكتبة", en: "From the library" },
  "discover.badge": { ar: "دليل المكتبة", en: "Library guide" },
  "discover.title": { ar: "مش عارف تبدأ منين؟ اسأل وهنرشّحلك", en: "Not sure where to start? Ask and we'll guide you" },
  "discover.subtitle": {
    ar: "اسأل عن العناوين أو أنهي كتاب يناسب موضوع معيّن أو أنهي تصنيف تختار — قبل ما تطلب الوصول.",
    en: "Ask about titles, which book fits a topic, or which category to pick — before you request access."
  },
  "discover.placeholder": { ar: "مثلاً: أنهي كتاب أقرأه عن القيادة؟", en: "e.g. Which book should I read about leadership?" },
  "discover.ask": { ar: "اسأل", en: "Ask" },
  "discover.s1": { ar: "أنهي كتاب يناسب القيادة؟", en: "Which book suits leadership?" },
  "discover.s2": { ar: "أنهي تصنيف أختار للإدارة؟", en: "Which category for management?" },
  "discover.s3": { ar: "إيه الكتب المتاحة عندكم؟", en: "What books do you have?" },
  "discover.error": { ar: "تعذّر الوصول للدليل الآن، حاول تاني.", en: "The guide is unavailable right now. Please try again." },
  "discover.requestHint": {
    ar: "عجبك كتاب أو تصنيف؟ اطلب الوصول وارفع إيصال الدفع، والأدمن هيفعّله لك.",
    en: "Like a book or category? Request access with your payment receipt and an admin will enable it."
  },
  "req.requestAccess": { ar: "اطلب الوصول", en: "Request access" },
  "req.title": { ar: "طلب وصول", en: "Request access" },
  "req.aBook": { ar: "كتاب", en: "A book" },
  "req.aCategory": { ar: "تصنيف", en: "A category" },
  "req.pickBook": { ar: "اختر كتاباً…", en: "Choose a book…" },
  "req.pickCategory": { ar: "اختر تصنيفاً…", en: "Choose a category…" },
  "req.uploadReceipt": { ar: "ارفع إيصال الدفع", en: "Upload payment receipt" },
  "req.notePlaceholder": { ar: "ملاحظة للأدمن (اختياري)", en: "Note to the admin (optional)" },
  "req.submit": { ar: "إرسال الطلب", en: "Submit request" },
  "req.submitted": { ar: "تم إرسال طلبك — قيد المراجعة", en: "Request sent — under review" },
  "req.needReceipt": { ar: "من فضلك ارفع صورة الإيصال.", en: "Please attach your payment receipt." },
  "req.needTarget": { ar: "من فضلك اختر كتاباً أو تصنيفاً.", en: "Please choose a book or category." },
  "req.failed": { ar: "تعذّر إرسال الطلب.", en: "Could not submit your request." },
  "req.myRequests": { ar: "طلباتي", en: "My requests" },
  "req.pending": { ar: "قيد المراجعة", en: "Pending" },
  "req.approved": { ar: "مفعّل", en: "Approved" },
  "req.rejected": { ar: "مرفوض", en: "Rejected" },
  "req.empty": { ar: "لا توجد طلبات هنا.", en: "No requests here." },
  "req.viewReceipt": { ar: "عرض الإيصال", en: "View receipt" },
  "req.approve": { ar: "تفعيل", en: "Approve" },
  "req.reject": { ar: "رفض", en: "Reject" },
  "req.rejectReasonPlaceholder": { ar: "اكتب سبب الرفض…", en: "Write the reason for rejecting…" },
  "req.rejectReasonRequired": { ar: "من فضلك اكتب سبب الرفض.", en: "Please write a reason for rejecting." },
  "req.confirmReject": { ar: "تأكيد الرفض", en: "Confirm reject" },
  "req.cancel": { ar: "إلغاء", en: "Cancel" },

  // Disliked-answers admin page
  "fb.title": { ar: "الإجابات غير المرضية", en: "Disliked answers" },
  "fb.subtitle": {
    ar: "الأسئلة التي أعطى المستخدمون عليها تقييمًا سلبيًا، مع الملاحظات المرفقة.",
    en: "Answers users marked unhelpful, with any notes they left."
  },
  "fb.needsReview": { ar: "بحاجة لمراجعة", en: "Needs review" },
  "fb.resolved": { ar: "تمت المراجعة", en: "Reviewed" },
  "fb.all": { ar: "الكل", en: "All" },
  "fb.emptyNeedsReview": { ar: "لا توجد إجابات غير مرضية بانتظار المراجعة. 🎉", en: "No disliked answers waiting for review. 🎉" },
  "fb.emptyResolved": { ar: "لا توجد إجابات تمت مراجعتها بعد.", en: "No reviewed answers yet." },
  "fb.emptyAll": { ar: "لا توجد ملاحظات بعد.", en: "No feedback yet." },
  "fb.question": { ar: "السؤال", en: "Question" },
  "fb.answer": { ar: "الإجابة", en: "Answer" },
  "fb.note": { ar: "ملاحظة المستخدم", en: "User's note" },
  "fb.noNote": { ar: "لم يترك المستخدم تفاصيل إضافية.", en: "No details were left." },
  "fb.noEvidence": { ar: "لم يتم تسجيل أي أدلة مع هذه الإجابة.", en: "No evidence was captured with this reply." },
  "fb.showMore": { ar: "عرض المزيد", en: "Show more" },
  "fb.showLess": { ar: "عرض أقل", en: "Show less" },
  "fb.markResolved": { ar: "وضع علامة تمت المراجعة", en: "Mark reviewed" },
  "fb.markUnresolved": { ar: "إرجاع لبحاجة لمراجعة", en: "Mark needs review" },
  "fb.disliked": { ar: "غير مفيدة", en: "Not helpful" },
  "fb.liked": { ar: "مفيدة", en: "Helpful" },
  "fb.loadError": { ar: "تعذّر تحميل الملاحظات.", en: "Could not load feedback." },

  "nav.requests": { ar: "طلبات الوصول", en: "Access requests" },
  "nav.users": { ar: "المستخدمون", en: "Users" },
  "nav.feedback": { ar: "الإجابات غير المرضية", en: "Disliked answers" },
  "nav.newDislikes": { ar: "إجابات غير مرضية جديدة", en: "new disliked answers" },
  "users.title": { ar: "المستخدمون والصلاحيات", en: "Users & access" },
  "users.search": { ar: "ابحث بالاسم أو الإيميل…", en: "Search by name or email…" },
  "users.empty": { ar: "لا يوجد مستخدمون.", en: "No users found." },
  "users.truncated": { ar: "عرض أول 200 مستخدم — ابحث بالاسم أو الإيميل للوصول لمستخدم معيّن.", en: "Showing the first 200 — search by name or email to find a specific user." },
  "users.adminFull": { ar: "أدمن — وصول كامل لكل الكتب.", en: "Admin — full access to all books." },
  "users.categories": { ar: "التصنيفات المتاحة", en: "Allowed categories" },
  "users.books": { ar: "الكتب المتاحة", en: "Allowed books" },
  "users.canDownload": { ar: "يمكنه التحميل", en: "Can download" },
  "users.noBooks": { ar: "لا توجد كتب متاحة.", en: "No books granted." },
  "picker.searchBooks": { ar: "ابحث عن كتاب بالاسم…", en: "Search books by title…" },
  "picker.typeToSearch": { ar: "اكتب للبحث في الكتب", en: "Type to search books" },
  "picker.noResults": { ar: "لا توجد نتائج.", en: "No matches." },
  "picker.searching": { ar: "جاري البحث…", en: "Searching…" },
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
  "an.revenue": { ar: "الإيرادات", en: "Revenue" },
  "an.revenueTotal": { ar: "إجمالي الإيرادات", en: "Total revenue" },
  "an.revenueMonth": { ar: "إيرادات هذا الشهر", en: "This month" },
  "an.pendingRequests": { ar: "طلبات قيد المراجعة", en: "Pending requests" },
  "an.revenueNote": { ar: "محسوبة من الطلبات المُفعّلة.", en: "Counted from approved access requests." },
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
  "an.unanswered": { ar: "أسئلة بلا إجابة", en: "Unanswered questions" },
  "an.unansweredNote": {
    ar: "أسئلة لم تجد لها المكتبة إجابة — مؤشرات على محتوى ناقص يمكن إضافته.",
    en: "Questions the library couldn't answer — signals of gaps you could fill."
  },
  "an.noUnanswered": { ar: "لا توجد أسئلة بلا إجابة بعد.", en: "No unanswered questions yet." },
  "an.feedback": { ar: "تقييم الإجابات", en: "Answer feedback" },
  "an.helpfulVotes": { ar: "مفيدة", en: "Helpful" },
  "an.notHelpfulVotes": { ar: "غير مفيدة", en: "Not helpful" },
  "an.reports": { ar: "بلاغات الأخطاء", en: "Error reports" },
  "an.noReports": { ar: "لا توجد بلاغات بعد.", en: "No reports yet." },
  "an.viewAllFeedback": { ar: "عرض كل الإجابات غير المرضية ←", en: "View all disliked answers →" },
  "an.adminOnly": { ar: "هذه الصفحة للمديرين فقط.", en: "This page is for admins only." },
  "an.loading": { ar: "جارٍ تحميل التحليلات…", en: "Loading analytics…" },
  "an.loadError": { ar: "تعذّر تحميل التحليلات.", en: "Could not load analytics." },

  // Organizations (universities) — platform admin
  "nav.organizations": { ar: "الجامعات", en: "Organizations" },
  "org.title": { ar: "الجامعات والمؤسسات", en: "Organizations" },
  "org.subtitle": {
    ar: "أضف جامعة، اشترك لها في كتب أو تصنيفات، وعيّن مديرًا يدير طلابها.",
    en: "Add a university, subscribe it to books or categories, and assign an admin to manage its students."
  },
  "org.namePlaceholder": { ar: "اسم الجامعة أو المؤسسة", en: "University or institution name" },
  "org.create": { ar: "إضافة", en: "Add" },
  "org.createError": { ar: "تعذر إضافة الجامعة.", en: "Could not create the organization." },
  "org.empty": { ar: "لا توجد جامعات بعد.", en: "No organizations yet." },
  "org.catalog": { ar: "الكتب والتصنيفات المشترك بها", en: "Subscribed books & categories" },
  "org.students": { ar: "طالب", en: "students" },
  "org.admins": { ar: "مدير", en: "admins" },
  "org.assignAdmin": { ar: "تعيين مدير للجامعة", en: "Assign organization admin" },
  "org.assignAdminEmail": { ar: "إيميل المستخدم", en: "User's email" },
  "org.assign": { ar: "تعيين", en: "Assign" },
  "org.assignSuccess": { ar: "تم التعيين", en: "Assigned" },
  "org.assignError": { ar: "تعذّر العثور على مستخدم بهذا الإيميل.", en: "Could not find a user with that email." },
  "org.noBooks": { ar: "لا توجد كتب مشترك بها.", en: "No books subscribed." },
  "org.delete": { ar: "حذف الجامعة", en: "Delete organization" },
  "org.deleteConfirm": {
    ar: "حذف هذه الجامعة؟ سيتم فصل كل الطلاب والمديرين عنها (كتبهم الممنوحة تبقى كما هي).",
    en: "Delete this organization? All its students and admins will be unlinked (their granted books stay untouched)."
  },
  "org.deleteError": { ar: "تعذّر حذف الجامعة.", en: "Could not delete this organization." },
  "org.quota": { ar: "عدد النسخ لهذا الكتاب (حسب ما دفعت عنه الجامعة)", en: "Seats for this book (what the org paid for)" },
  "org.quotaPlaceholder": { ar: "بدون حد", en: "Unlimited" },
  "org.quotaError": { ar: "تعذّر تحديث الحد.", en: "Could not update the limit." },

  // Org admin — manage own students
  "nav.orgStudents": { ar: "طلابي", en: "My Students" },
  "nav.orgAdminSection": { ar: "الجامعة", en: "Organization" },
  "orgAdmin.title": { ar: "طلاب الجامعة", en: "Organization students" },
  "orgAdmin.subtitle": {
    ar: "أضف طلابًا بعد ما يدفعوا لك، وافتحلهم الكتب والتصنيفات اللي جامعتك مشتركة فيها.",
    en: "Add students once they've paid you, and grant them the books/categories your organization subscribes to."
  },
  "orgAdmin.catalogTitle": { ar: "كتب وتصنيفات جامعتك", en: "Your organization's catalog" },
  "orgAdmin.addStudent": { ar: "إضافة طالب", en: "Add student" },
  "orgAdmin.studentEmail": { ar: "إيميل الطالب (لازم يكون له حساب بالفعل)", en: "Student's email (must already have an account)" },
  "orgAdmin.add": { ar: "إضافة", en: "Add" },
  "orgAdmin.addError": { ar: "تعذّر إضافة هذا الطالب.", en: "Could not add this student." },
  "orgAdmin.empty": { ar: "لا يوجد طلاب في جامعتك بعد.", en: "No students in your organization yet." },
  "orgAdmin.remove": { ar: "إزالة من الجامعة", en: "Remove from organization" },
  "orgAdmin.noCatalog": {
    ar: "جامعتك لسه مش مشتركة في أي كتاب أو تصنيف — تواصل مع الإدارة.",
    en: "Your organization hasn't subscribed to any book or category yet — contact the platform admin."
  },
  "orgAdmin.grantError": { ar: "تعذّر منح هذا الكتاب.", en: "Could not grant this book." },
  "orgAdmin.seatsLeft": { ar: "نسخة متبقية", en: "left" }
  ,
  "nav.orgNetwork": { ar: "شبكة الجامعة", en: "Campus network" },
  "orgNet.title": { ar: "الوصول عبر شبكة الجامعة", en: "Campus network access" },
  "orgNet.subtitle": {
    ar: "أي حد متصل من الـ IP بتاع الجامعة يقدر يفتح كتب اشتراككم من غير تسجيل دخول.",
    en: "Anyone browsing from your organization's IP can open your subscribed books without signing in."
  },
  "orgNet.enabled": { ar: "مُفعَّل", en: "Enabled" },
  "orgNet.disabled": { ar: "متوقف", en: "Disabled" },
  "orgNet.networks": { ar: "الشبكات المسموح بها", en: "Allowed networks" },
  "orgNet.none": { ar: "لا توجد شبكات مضافة", en: "No allowed networks" },
  "orgNet.placeholder": { ar: "IP عام أو نطاق CIDR (مثال 197.45.10.0/24)", en: "Public IP or CIDR (e.g. 197.45.10.0/24)" },
  "orgNet.add": { ar: "إضافة", en: "Add" },
  "orgNet.currentIp": { ar: "الـ IP الحالي", en: "Current IP" },
  "orgNet.detect": { ar: "اكتشاف", en: "Detect" },
  "orgNet.test": { ar: "اختبار", en: "Test" },
  "orgNet.allowed": { ar: "مسموح", en: "Allowed" },
  "orgNet.notAllowed": { ar: "غير مسموح", en: "Not allowed" },
  "orgNet.saved": { ar: "تم الحفظ", en: "Saved" },
  "orgNet.saveError": { ar: "تعذّر حفظ إعدادات الشبكة.", en: "Could not save the network policy." },
  "orgNet.downloads": { ar: "كتب يُسمح بتحميلها من الشبكة", en: "Books downloadable from the network" },
  "orgNet.hint": {
    ar: "استخدم الـ IP العام للجامعة (مش IP الجهاز الداخلي). لو الشبكة بتغيّر الـ IP، اطلب من قسم الشبكات نطاق ثابت.",
    en: "Use the organization's public IP (not a device's internal IP). If it changes, ask your network team for a static range."
  }
,
  "nav.notifications": { ar: "Notifications", en: "Notifications" },
  "nav.newNotifications": { ar: "new notifications", en: "new notifications" },
  "notifications.title": { ar: "Notifications", en: "Notifications" },
  "notifications.subtitle": { ar: "Important activity that needs your attention.", en: "Important activity that needs your attention." },
  "notifications.markAll": { ar: "Mark all read", en: "Mark all read" },
  "notifications.empty": { ar: "You have no notifications yet.", en: "You have no notifications yet." },
  "notifications.push.enable": { ar: "Enable push notifications", en: "Enable push notifications" },
  "notifications.push.disable": { ar: "Disable push notifications", en: "Disable push notifications" },
  "notifications.push.enabled": { ar: "Push notifications are on for this device.", en: "Push notifications are on for this device." },
  "notifications.push.denied": { ar: "Notifications are blocked in your browser settings.", en: "Notifications are blocked in your browser settings." },
  "notifications.push.unavailable": { ar: "Push notifications are not configured on this server yet.", en: "Push notifications are not configured on this server yet." },
  // Support messaging ("contact us")
  "nav.support": { ar: "المراسلات", en: "Messages" },
  "nav.newSupportMessages": { ar: "رسائل جديدة", en: "new messages" },
  "support.title": { ar: "المراسلات", en: "Messages" },
  "support.subtitleUser": { ar: "تواصل مباشرةً مع إدارة المنصّة", en: "Talk directly to the platform team" },
  "support.subtitleAdmin": { ar: "رسائل المستخدمين الواردة", en: "Incoming messages from readers" },
  "support.new": { ar: "رسالة جديدة", en: "New message" },
  "support.newTitle": { ar: "رسالة جديدة إلى الإدارة", en: "New message to the team" },
  "support.subject": { ar: "الموضوع", en: "Subject" },
  "support.subjectPlaceholder": { ar: "بمَ يمكننا مساعدتك؟", en: "What can we help you with?" },
  "support.topic": { ar: "التصنيف", en: "Topic" },
  "support.messagePlaceholder": {
    ar: "اشرح استفسارك أو المشكلة بالتفصيل…",
    en: "Describe your question or issue…"
  },
  "support.replyPlaceholder": { ar: "اكتب ردّك…", en: "Write your reply…" },
  "support.send": { ar: "إرسال", en: "Send" },
  "support.sending": { ar: "جارٍ الإرسال…", en: "Sending…" },
  "support.cancel": { ar: "إلغاء", en: "Cancel" },
  "support.back": { ar: "رجوع", en: "Back" },
  "support.attach": { ar: "إرفاق ملف", en: "Attach a file" },
  "support.attachHint": {
    ar: "صور أو PDF أو Word أو Excel أو نص — حتى ٥ ملفات، ١٠ ميجابايت لكل ملف",
    en: "Images, PDF, Word, Excel, or text — up to 5 files, 10 MB each"
  },
  "support.removeFile": { ar: "إزالة الملف", en: "Remove file" },
  "support.download": { ar: "تنزيل", en: "Download" },
  "support.close": { ar: "إغلاق المحادثة", en: "Close" },
  "support.reopen": { ar: "إعادة الفتح", en: "Reopen" },
  "support.closed": { ar: "مغلقة", en: "Closed" },
  "support.open": { ar: "مفتوحة", en: "Open" },
  "support.needsReply": { ar: "بانتظار الرد", en: "Needs reply" },
  "support.all": { ar: "الكل", en: "All" },
  "support.searchPlaceholder": { ar: "ابحث في المواضيع…", en: "Search subjects…" },
  "support.emptyList": { ar: "لا توجد محادثات بعد", en: "No conversations yet" },
  "support.emptyListHint": {
    ar: "ابدأ محادثة جديدة وسيصلك الرد هنا.",
    en: "Start a conversation and the reply will land here."
  },
  "support.emptyInbox": { ar: "لا توجد رسائل في هذا العرض", en: "Nothing in this view" },
  "support.pickThread": { ar: "اختر محادثة لعرضها", en: "Pick a conversation to read it" },
  "support.you": { ar: "أنت", en: "You" },
  "support.team": { ar: "فريق الدعم", en: "Support team" },
  "support.truncated": { ar: "يتم عرض أحدث الرسائل فقط.", en: "Only the most recent messages are shown." },
  "support.closedNotice": {
    ar: "هذه المحادثة مغلقة. أي رسالة جديدة ستعيد فتحها.",
    en: "This conversation is closed. A new message reopens it."
  },
  "support.tooManyFiles": { ar: "يمكنك إرفاق ٥ ملفات كحدٍّ أقصى.", en: "You can attach up to 5 files." },
  "support.fileTooLarge": { ar: "حجم الملف يتجاوز ١٠ ميجابايت.", en: "That file is larger than 10 MB." },
  "support.sendFailed": { ar: "تعذّر إرسال الرسالة.", en: "Could not send your message." },
  "support.topic.general": { ar: "استفسار عام", en: "General" },
  "support.topic.access": { ar: "الاشتراك والصلاحيات", en: "Access & subscription" },
  "support.topic.technical": { ar: "مشكلة تقنية", en: "Technical issue" },
  "support.topic.content": { ar: "محتوى الكتب", en: "Book content" },
  "support.topic.billing": { ar: "الدفع والفواتير", en: "Payments" },
  "set.notifications": { ar: "إشعارات الجهاز", en: "Device notifications" },
  "set.notificationsDesc": {
    ar: "استقبل تنبيهًا على هذا الجهاز عند وصول رد أو تحديث مهم.",
    en: "Get an alert on this device when a reply or an important update arrives."
  },
  "set.notificationsHint": {
    ar: "الإعداد خاص بكل جهاز ومتصفح على حدة، ويتطلب فتح الموقع عبر HTTPS.",
    en: "This is per device and browser, and needs the site to be served over HTTPS."
  },

  // Admin accounts and permissions
  "nav.admins": { ar: "المديرون", en: "Admins" },
  "admins.title": { ar: "المديرون والصلاحيات", en: "Admins & permissions" },
  "admins.subtitle": {
    ar: "أنشئ حسابات إدارة وحدّد لكل واحد ما يستطيع الوصول إليه.",
    en: "Create admin accounts and decide exactly what each one can reach."
  },
  "admins.new": { ar: "مدير جديد", en: "New admin" },
  "admins.newTitle": { ar: "حساب مدير جديد", en: "New admin account" },
  "admins.name": { ar: "الاسم", en: "Name" },
  "admins.email": { ar: "البريد الإلكتروني", en: "Email" },
  "admins.password": { ar: "كلمة المرور", en: "Password" },
  "admins.create": { ar: "إنشاء الحساب", en: "Create account" },
  "admins.cancel": { ar: "إلغاء", en: "Cancel" },
  "admins.you": { ar: "أنت", en: "You" },
  "admins.selfNote": {
    ar: "لا يمكنك تعديل صلاحيات حسابك؛ يلزم مدير آخر لتغييرها.",
    en: "You cannot change your own permissions — another admin has to."
  },
  "admins.demote": { ar: "إلغاء الإشراف", en: "Remove admin" },
  "admins.demoteTitle": {
    ar: "تحويل هذا الحساب إلى مستخدم عادي؟",
    en: "Turn this account back into a regular user?"
  },
  "admins.saveFailed": { ar: "تعذّر حفظ التغيير.", en: "Could not save the change." },

  "perm.books": { ar: "الكتب", en: "Books" },
  "perm.books.desc": {
    ar: "رفع الكتب وتعديلها وحذفها، وإدارة التصنيفات والاستيراد.",
    en: "Upload, edit, and delete books; manage categories and imports."
  },
  "perm.requests": { ar: "طلبات الوصول", en: "Access requests" },
  "perm.requests.desc": {
    ar: "مراجعة طلبات الاشتراك وقبولها أو رفضها.",
    en: "Review paid access requests and approve or reject them."
  },
  "perm.users": { ar: "المستخدمون", en: "Users" },
  "perm.users.desc": {
    ar: "عرض المستخدمين ومنح أو سحب صلاحية قراءة الكتب.",
    en: "See readers and grant or revoke their access to books."
  },
  "perm.organizations": { ar: "الجهات", en: "Organizations" },
  "perm.organizations.desc": {
    ar: "إدارة الجامعات والجهات المشتركة ومدرائها.",
    en: "Manage subscribing organizations, their catalog, and their admins."
  },
  "perm.support": { ar: "الرد على المراسلات", en: "Answer messages" },
  "perm.support.desc": {
    ar: "قراءة مراسلات المستخدمين والرد عليها.",
    en: "Read readers' conversations and reply to them."
  },
  "perm.feedback": { ar: "ملاحظات الإجابات", en: "Answer feedback" },
  "perm.feedback.desc": {
    ar: "مراجعة الإجابات التي قيّمها القراء سلبًا.",
    en: "Triage answers readers marked as unhelpful."
  },
  "perm.analytics": { ar: "الإحصاءات", en: "Analytics" },
  "perm.analytics.desc": {
    ar: "الاطلاع على إحصاءات الاستخدام والمحتوى.",
    en: "View usage and content statistics."
  },
  "perm.admins": { ar: "إدارة المديرين", en: "Manage admins" },
  "perm.admins.desc": {
    ar: "إنشاء حسابات إدارة وتحديد صلاحياتها. امنحها بحذر.",
    en: "Create admin accounts and set their permissions. Grant sparingly."
  },
  // Shared verbs and controls
  "common.remove": { ar: "إزالة", en: "Remove" },
  "common.cancel": { ar: "إلغاء", en: "Cancel" },
  "common.close": { ar: "إغلاق", en: "Close" },
  "common.clear": { ar: "مسح", en: "Clear" },
  "common.open": { ar: "فتح", en: "Open" },
  "common.download": { ar: "تنزيل", en: "Download" },
  "common.saved": { ar: "تم الحفظ", en: "Saved" },
  "common.toggleTheme": { ar: "تبديل المظهر", en: "Toggle theme" },

  // Library: covers
  "lib.gridView": { ar: "عرض شبكي", en: "Grid view" },
  "lib.listView": { ar: "عرض قائمة", en: "List view" },
  "lib.favoriteAdd": { ar: "إضافة إلى المفضّلة", en: "Add to favorites" },
  "lib.favoriteRemove": { ar: "إزالة من المفضّلة", en: "Remove from favorites" },
  "lib.deleteBook": { ar: "حذف {title}", en: "Delete {title}" },
  "lib.coverAlt": { ar: "غلاف الكتاب", en: "Book cover" },
  "lib.coverShort": { ar: "الغلاف", en: "Cover" },
  "lib.coverAddShort": { ar: "إضافة غلاف", en: "Add cover" },
  "lib.coverAdd": { ar: "إضافة غلاف", en: "Add a cover" },
  "lib.coverReplaceOrRemove": { ar: "استبدال الغلاف أو إزالته", en: "Replace or remove the cover" },
  "lib.coverReplaceButton": { ar: "استبدال الغلاف", en: "Replace cover" },
  "lib.coverChoose": { ar: "اختر ملف الغلاف", en: "Choose a cover file" },
  "lib.coverChooseReplacement": { ar: "اختر غلافًا بديلًا", en: "Choose a replacement cover" },
  "lib.coverNoneYet": {
    ar: "لم يُضف غلاف بعد. المكتبة تعرض الصفحة الأولى من الكتاب بدلًا منه.",
    en: "No cover has been added yet. The library shows the book’s first page instead."
  },
  "lib.coverHint": {
    ar: "صورة واحدة تحمل وجهَي الغلاف — الوش في نصفها الأيسر والضهر في الأيمن. PNG أو JPEG أو WEBP. ويصلح ملف PDF أيضًا: صفحة واحدة تحمل الوجهين، أو الوش والضهر في أول صفحتين.",
    en: "One image holding both faces — the front on its left half, the back on its right. PNG, JPEG, or WEBP. A PDF works too: one page holding the spread, or front and back as its first two pages."
  },
  "lib.coverRemoveConfirm": {
    ar: "إزالة هذا الغلاف؟ ستخرج صفحتاه من ملف الـPDF.",
    en: "Remove this cover? Its two pages come back out of the PDF."
  },
  "lib.coverUploadFailed": { ar: "تعذّر رفع الغلاف.", en: "The cover could not be uploaded." },
  "lib.coverRemoveFailed": { ar: "تعذّرت إزالة الغلاف.", en: "The cover could not be removed." },

  // Library: summary audio
  "lib.audioLabel": { ar: "الملخّص الصوتي", en: "Summary audio" },
  "lib.audioBadge": { ar: "صوت", en: "Audio" },
  "lib.audioAvailable": { ar: "يتوفّر ملخّص صوتي", en: "Summary audio available" },
  "lib.audioAddShort": { ar: "إضافة صوت", en: "Add audio" },
  "lib.audioAdd": { ar: "إضافة ملخّص صوتي", en: "Add summary audio" },
  "lib.audioReplaceOrRemove": { ar: "استبدال الملخّص الصوتي أو إزالته", en: "Replace or remove summary audio" },
  "lib.audioReplaceButton": { ar: "استبدال الصوت", en: "Replace audio" },
  "lib.audioChoose": { ar: "اختر ملفًا صوتيًا", en: "Choose an audio file" },
  "lib.audioChooseReplacement": { ar: "اختر ملفًا صوتيًا بديلًا", en: "Choose replacement audio" },
  "lib.audioNoneYet": { ar: "لم يُضف ملخّص صوتي بعد.", en: "No summary audio has been added yet." },
  "lib.audioFormats": { ar: "MP3 أو M4A أو WAV أو OGG أو WEBM أو AAC أو FLAC", en: "MP3, M4A, WAV, OGG, WEBM, AAC, or FLAC" },
  "lib.audioRemoveConfirm": { ar: "إزالة الملخّص الصوتي من هذا الكتاب؟", en: "Remove this summary audio from the book?" },
  "lib.audioUploadFailed": { ar: "تعذّر رفع الملخّص الصوتي.", en: "The summary audio could not be uploaded." },
  "lib.audioRemoveFailed": { ar: "تعذّرت إزالة الملخّص الصوتي.", en: "The summary audio could not be removed." },

  // Upload page
  "up.addSummaryAudio": { ar: "إضافة ملخّص صوتي", en: "Add summary audio" },
  "up.addCover": { ar: "إضافة غلاف", en: "Add cover" },
  "up.attached": { ar: "مُرفق", en: "Attached" },
  "up.coverSet": { ar: "تم ضبط الغلاف", en: "Cover set" },
  "up.coverHint": {
    ar: "الملخّص الصوتي والغلاف اختياريان ويمكن إضافتهما لاحقًا من المكتبة. الغلاف صورة أو ملف PDF يحمل وجهَي الغلاف المطبوع — الوش في النصف الأيسر والضهر في الأيمن. ويمكن لملف الـPDF أن يحمل الوش والضهر في أول صفحتين بدلًا من ذلك.",
    en: "Summary audio and the cover are optional and can also be added later from Library. A cover is one image or PDF holding both faces of the printed jacket — the front on its left half, the back on its right. A PDF may instead carry the front and back as its first two pages."
  },
  "up.coverUnsupported": {
    ar: "«{name}» ليس ملف غلاف مدعومًا. استخدم صورة PNG أو JPEG أو WEBP، أو ملف PDF.",
    en: "“{name}” is not a supported cover file. Use a PNG, JPEG, or WEBP image, or a PDF."
  },
  "up.coverPdfOnly": {
    ar: "لا يمكن إضافة غلاف إلا إلى ملف PDF، و«{name}» ليس كذلك.",
    en: "A cover can only be added to a PDF, and “{name}” is not one."
  },
  "up.audioUnsupported": {
    ar: "«{name}» ليس ملفًا صوتيًا مدعومًا.",
    en: "“{name}” is not a supported audio file."
  },
  "up.excelTitle": { ar: "استيراد الكتب من ملف Excel", en: "Import books from Excel" },
  "up.excelDesc": {
    ar: "ارفع القائمة، اختر كتبًا بعينها، ثم استورد ملفات الـPDF الخاصة بها وحدها.",
    en: "Upload the list, choose specific books, then import only those PDFs."
  },
  "up.chooseXlsx": { ar: "اختر ملف ‎.xlsx", en: "Choose .xlsx" },
  "up.reading": { ar: "جارٍ القراءة…", en: "Reading…" },
  "up.selectAll": { ar: "تحديد الكل", en: "Select all" },
  "up.deselectAll": { ar: "إلغاء تحديد الكل", en: "Deselect all" },
  "up.selectedCount": { ar: "{count} محدّد", en: "{count} selected" },
  "up.noCategory": { ar: "بدون تصنيف", en: "No category" },
  "up.pricePlaceholder": { ar: "السعر (اختياري)", en: "Price (optional)" },
  "up.unknownAuthor": { ar: "مؤلف غير معروف", en: "Unknown author" },
  "up.row": { ar: "صف {number}", en: "row {number}" },
  "up.suggestSelected": { ar: "اقترح تصنيفات للمحدّد", en: "Suggest categories for selected" },
  "up.suggestAi": { ar: "اقترح تصنيفات بالذكاء الاصطناعي", en: "Suggest categories with AI" },
  "up.categorising": { ar: "جارٍ التصنيف…", en: "Categorising…" },
  "up.importSelected": { ar: "استيراد {count} محدّد", en: "Import {count} selected" },
  "up.importing": { ar: "جارٍ الاستيراد…", en: "Importing…" },
  "up.categoriseFailed": { ar: "تعذّر على الذكاء الاصطناعي تصنيف هذه الكتب.", en: "The AI could not categorise these books." },
  "up.importFailed": { ar: "فشل الاستيراد. الدفعات المكتملة محفوظة.", en: "Import failed. Completed batches were kept." },
  "up.workbookFailed": { ar: "تعذّرت قراءة الملف.", en: "The workbook could not be read." },

  // Organizations: network policy
  "org.networkAccess": { ar: "الوصول عبر الشبكة", en: "Network access" },
  "org.networkDownloads": { ar: "التنزيل عبر الشبكة", en: "Network downloads" },
  "org.noAllowedNetworks": { ar: "لا توجد شبكات مسموح بها", en: "No allowed networks" },
  "org.ipPlaceholder": { ar: "عنوان IP عام أو نطاق CIDR", en: "Public IP or CIDR" },
  "org.detect": { ar: "اكتشاف", en: "Detect" },
  "org.test": { ar: "اختبار", en: "Test" },
  "org.removeCidr": { ar: "إزالة {cidr}", en: "Remove {cidr}" },
  "org.currentIp": { ar: "عنوانك الحالي: {ip}", en: "Current IP: {ip}" },
  "org.notAllowed": { ar: "غير مسموح", en: "Not allowed" },
  "org.savePolicyFailed": { ar: "تعذّر حفظ سياسة الشبكة.", en: "Could not save network policy." },
  "org.detectIpFailed": { ar: "تعذّر اكتشاف عنوانك الحالي.", en: "Could not detect current IP." },
  "org.testIpFailed": { ar: "تعذّر اختبار العنوان.", en: "Could not test IP." },

  // Readers
  "reader.zoomIn": { ar: "تكبير", en: "Zoom in" },
  "reader.zoomOut": { ar: "تصغير", en: "Zoom out" },
  "reader.pdfOnly": { ar: "يدعم Heyzine ملفات PDF فقط حاليًا.", en: "Heyzine currently supports PDF books only." },
  "reader.receiptAlt": { ar: "إيصال الدفع", en: "Payment receipt" },

  // Ask
  "ask.stopGenerating": { ar: "إيقاف التوليد", en: "Stop generating" },
  "ask.openSourceAt": { ar: "فتح {book} عند صفحة {page}", en: "Open {book} at page {page}" },

  // Quiz
  "quiz.correct": { ar: "إجابة صحيحة.", en: "Correct." },
  "quiz.correctAnswerIs": { ar: "الإجابة الصحيحة هي", en: "The correct answer is" },
  "quiz.showSample": { ar: "عرض إجابة نموذجية", en: "Show sample answer" },
  "quiz.hideSample": { ar: "إخفاء الإجابة النموذجية", en: "Hide sample answer" },
  "up.excelFound": {
    ar: "تم العثور على {total} كتاب. اختر ما تريد استيراده؛ التحديدات الكبيرة تُعالَج على دفعات.",
    en: "{total} books found. Select books to import; large selections are processed in batches."
  },
  "up.excelCategorised": { ar: "تم تصنيف {done} من {total} كتاب", en: "{done} of {total} books categorised" },
  "up.excelNewCategory": { ar: "؛ استخدم {count} منها تصنيفًا جديدًا (أُبلغ المديرون).", en: "; {count} used a new category (admins notified)." },
  "up.excelQueued": { ar: "تم إدراج {count} كتاب في الطابور", en: "{count} books queued" },
  "up.excelFailedSuffix": { ar: "؛ فشل {count}", en: "; {count} failed" },

} as const;

export type StringKey = keyof typeof STRINGS;

/**
 * Error copy keyed by the `code` the API returns alongside every failure.
 *
 * The API answers in English because its messages are part of the protocol,
 * read by logs and other callers as much as by people. The reader's language
 * is decided here instead: a code listed below is shown in their language, and
 * anything unlisted falls back to the server's own message, so a new code is
 * never a blank screen.
 */
export const ERROR_STRINGS: Record<string, { ar: string; en: string }> = {
  // Transport
  NETWORK: { ar: "تعذّر الوصول إلى الخادم.", en: "Could not reach the server." },
  STREAM_INTERRUPTED: { ar: "انقطع الاتصال أثناء الرد.", en: "The connection was interrupted." },
  REQUEST_FAILED: { ar: "فشل الطلب. حاول مرة أخرى.", en: "The request failed. Please try again." },

  // Auth and permissions
  UNAUTHORIZED: { ar: "انتهت جلستك. سجّل الدخول من جديد.", en: "Your session ended. Please sign in again." },
  FORBIDDEN: { ar: "ليس لديك صلاحية لهذا الإجراء.", en: "You do not have permission for this." },
  MISSING_PERMISSION: { ar: "هذا الإجراء يحتاج صلاحية لا يملكها حسابك.", en: "Your account is missing the permission for this." },
  INVALID_CREDENTIALS: { ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة.", en: "That email or password is not right." },
  EMAIL_ALREADY_EXISTS: { ar: "هذا البريد الإلكتروني مسجّل بالفعل.", en: "That email is already registered." },
  ORG_NETWORK_ACCESS_DENIED: { ar: "لا يمكن الوصول من هذه الشبكة.", en: "This network is not allowed to reach the library." },
  BOOK_ACCESS_REQUIRED: { ar: "هذا الكتاب يحتاج اشتراكًا.", en: "This book needs a subscription." },
  BOOK_ACCESS_DENIED: { ar: "ليس لديك وصول إلى هذا الكتاب.", en: "You do not have access to this book." },

  // Missing things
  BOOK_NOT_FOUND: { ar: "لم يُعثر على هذا الكتاب.", en: "This book was not found." },
  FILE_NOT_AVAILABLE: { ar: "لم يُعثر على الملف الأصلي.", en: "The original file could not be found." },
  PAGE_NOT_FOUND: { ar: "لم يُعثر على هذه الصفحة.", en: "This page was not found." },
  COVER_NOT_FOUND: { ar: "لا يوجد غلاف لهذا الكتاب.", en: "This book has no uploaded cover." },
  SUMMARY_AUDIO_NOT_FOUND: { ar: "لا يوجد ملخّص صوتي لهذا الكتاب.", en: "This book has no summary audio." },
  USER_NOT_FOUND: { ar: "لم يُعثر على هذا المستخدم.", en: "This user was not found." },
  ORG_NOT_FOUND: { ar: "لم يُعثر على هذه الجهة.", en: "This organization was not found." },
  STUDENT_NOT_FOUND: { ar: "لم يُعثر على هذا الطالب.", en: "This student was not found." },
  CATEGORY_NOT_FOUND: { ar: "لم يُعثر على هذا التصنيف.", en: "This category was not found." },
  CONVERSATION_NOT_FOUND: { ar: "لم يُعثر على هذه المحادثة.", en: "This conversation was not found." },
  REQUEST_NOT_FOUND: { ar: "لم يُعثر على هذا الطلب.", en: "This request was not found." },
  RECEIPT_NOT_FOUND: { ar: "لم يُعثر على الإيصال.", en: "That receipt was not found." },
  ATTACHMENT_NOT_FOUND: { ar: "لم يُعثر على المرفق.", en: "That attachment was not found." },
  THREAD_NOT_FOUND: { ar: "لم يُعثر على هذه المراسلة.", en: "That conversation was not found." },
  NOTIFICATION_NOT_FOUND: { ar: "لم يُعثر على هذا الإشعار.", en: "That notification was not found." },

  // Uploads and files
  INVALID_FILE_TYPE: { ar: "ارفع ملف PDF أو EPUB أو DOCX أو TXT.", en: "Please upload a PDF, EPUB, DOCX, or TXT file." },
  INVALID_COVER_TYPE: { ar: "ارفع صورة PNG أو JPEG أو WEBP، أو ملف PDF، كغلاف.", en: "Please upload a PNG, JPEG, or WEBP image, or a PDF, as the cover." },
  INVALID_AUDIO_TYPE: { ar: "ارفع ملفًا صوتيًا MP3 أو M4A أو WAV أو OGG أو WEBM أو AAC أو FLAC.", en: "Please upload an MP3, M4A, WAV, OGG, WEBM, AAC, or FLAC audio file." },
  MISSING_FILE: { ar: "اختر ملفًا أولًا.", en: "Please choose a file first." },
  MISSING_COVER: { ar: "اختر ملف الغلاف.", en: "Please choose a cover file." },
  MISSING_AUDIO: { ar: "اختر ملفًا صوتيًا.", en: "Please choose an audio file." },
  MISSING_RECEIPT: { ar: "أرفق صورة الإيصال.", en: "Please attach the receipt." },
  INVALID_RECEIPT: { ar: "تعذّرت قراءة هذا الإيصال.", en: "That receipt could not be read." },
  NOT_A_PDF: { ar: "هذا الإجراء يخصّ ملفات PDF فقط.", en: "This only applies to PDF books." },
  UPLOAD_FAILED: { ar: "فشل الرفع. حاول مرة أخرى.", en: "The upload failed. Please try again." },

  // Excel import
  INVALID_EXCEL: { ar: "تعذّرت قراءة الملف.", en: "The workbook could not be read." },
  NO_ROWS: { ar: "لا توجد صفوف في هذا الملف.", en: "That workbook has no rows." },
  TOO_MANY_ROWS: { ar: "عدد الصفوف أكبر مما يمكن استيراده دفعة واحدة.", en: "That workbook has more rows than one import can take." },
  TOO_MANY_BOOKS: { ar: "عدد الكتب أكبر مما يمكن استيراده دفعة واحدة.", en: "That is more books than one import can take." },
  NO_BOOKS: { ar: "لم تُحدَّد أي كتب.", en: "No books were selected." },
  UNKNOWN_CATEGORY: { ar: "تصنيف غير معروف.", en: "That category is not one of yours." },

  // Chat
  CHAT_FAILED: { ar: "فشل طلب المحادثة.", en: "The chat request failed." },
  EMPTY_MESSAGE: { ar: "اكتب رسالة أولًا.", en: "Write a message first." },
  INVALID_CONVERSATION: { ar: "هذه المحادثة غير صالحة.", en: "That conversation is not valid." },

  // Providers
  OPENROUTER_NOT_CONFIGURED: { ar: "خدمة الذكاء الاصطناعي غير مهيّأة بعد.", en: "The AI provider is not configured yet." },
  OCR_OUT_OF_CREDITS: { ar: "نفد رصيد خدمة استخراج النص.", en: "The OCR provider is out of credits." },
  OCR_PROVIDER_ERROR: { ar: "تعذّر على خدمة استخراج النص معالجة هذه الصفحة.", en: "The OCR provider could not process this page." },
  OPENROUTER_EMBEDDING_FAILURE: { ar: "تعذّر على خدمة الفهرسة معالجة هذا الكتاب.", en: "The embedding provider could not process this book." }
};

/**
 * Turn a failed request into a sentence in the reader's language.
 *
 * Pass whatever was caught: an `ApiClientError` carries the code this looks
 * up, and anything else falls back to its own message.
 */
export function useErrorText() {
  const { lang } = useLang();

  return useCallback(
    (error: unknown, fallbackKey?: StringKey): string => {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : undefined;
      const entry = code ? ERROR_STRINGS[code] : undefined;
      if (entry) return entry[lang];
      if (error instanceof Error && error.message) return error.message;
      if (fallbackKey) return STRINGS[fallbackKey]?.[lang] ?? fallbackKey;
      return ERROR_STRINGS.REQUEST_FAILED?.[lang] ?? "";
    },
    [lang]
  );
}


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

/**
 * `t` with `{placeholder}` substitution, for copy that carries a name or a
 * count. A placeholder with no value is left visible rather than blanked, so a
 * missing variable shows up instead of quietly reading as finished copy.
 */
export function useTf() {
  const { t } = useLang();
  return useCallback(
    (key: StringKey, vars: Record<string, string | number>) =>
      t(key).replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole)),
    [t]
  );
}

export function useT() {
  return useLang().t;
}
