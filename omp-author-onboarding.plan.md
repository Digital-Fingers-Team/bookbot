# خطة: زرار "فعّل حساب مؤلف" + الدخول على OMP

> الهدف: المستخدم في bookbot يضغط زرار → يتعمله حساب **مؤلف (Author)** في OMP
> تحت press الـ`arado` → يقدر يدخل OMP بـ **auto-login** ويبدأ دورة مراجعة/تحرير
> كاملة مع المحررين.
>
> **القرار المعماري (محسوم):** المؤلف بيدخل workflow تحريري كامل، فالـ Headless
> مرفوض. bookbot = نقطة الدخول، OMP = مساحة الشغل. الدخول = auto-login (مش SSO
> كامل دلوقتي، بس متصمّم بحيث نقدر نرقّيه لـ SSO بعدين من غير كسر).

## الحقائق المرجعية (تم التحقق منها)
- OMP على `http://localhost:8091`، press path = `arado` (id 1)، admin `admin`/`OmpAdmin123!`.
- bookbot API: `apps/api` (Express, port 4000)، MongoDB (Atlas، من `.env`).
- موجود فعلاً: `OMP_BASE_URL`, `OMP_CONTEXT_PATH=arado`, `OMP_API_TOKEN` (admin، user 1).
- موجود: [omp.client.ts](apps/api/src/services/omp/omp.client.ts) (health + catalog)،
  [omp.routes.ts](apps/api/src/routes/omp.routes.ts).
- OMP بياخد التوكن من `?apiToken=` مش من Authorization header.
- موديل اليوزر: [user.model.ts](apps/api/src/models/user.model.ts) (name/email/passwordHash/role/language).

## الثوابت
- نظامين منفصلين عبر REST API. bookbot=MongoDB، OMP=MariaDB. **مفيش دمج قواعد بيانات.**
- الأسرار في `.env` فقط (gitignored). password الـOMP يتخزّن **مشفّر** (مش plaintext، مش hash فقط — محتاجين نفكّه عشان auto-login).
- commits صغيرة على `main`، بترايلر `Co-Authored-By: Claude Opus 4.8`.
- Git Bash بيخرّب مسارات `/...` للـ exes → نستخدم `MSYS_NO_PATHCONV=1`.

---

## المراحل

### مرحلة 0 — تحقّق: هل OMP REST API بيعمل يوزر؟ ✅ **خلصت**

**النتائج الفعلية (ضد OMP 3.5.0.4 الحي):**

1. **إنشاء اليوزر عبر REST API → غير مدعوم.** `/api/v1/users` بيدعم `GET, HEAD` بس.
   `POST` بيرجّع: `"The POST method is not supported... Supported methods: GET, HEAD"`.
   و`DELETE` بيرجّع 500. يعني الـ REST API للقراءة بس.

2. **الحل المعتمد لإنشاء اليوزر → فورم التسجيل بتاع OMP** (`POST /arado/user/register`).
   - مُختبر وشغّال: أنشأ user id=2 بدور **Reader**، `disabled:false` (مفيش تفعيل إيميل).
   - بيمشّي منطق OMP بالكامل (هاشينج باسورد صح). أنضف من DB insert.
   - الحقول: `csrfToken` (من `<input name="csrfToken">` في صفحة register)،
     `username, email, givenName, familyName, affiliation, country, password,
     password2, privacyConsent=1, emailConsent`.
   - يحتاج: GET صفحة register الأول (كوكي + csrf)، بعدين POST بنفس الكوكي.
   - دور **Author** بيتسند تلقائياً أول submission — مش لازم نظبطه يدوي.

3. **اللوجين البرمجي → شغّال** (`POST /arado/login/signIn` بـ csrf + كوكي جلسة)
   بيرجّع 302 + كوكي `OMPSID`. بس **CSRF مفروض** — signIn من غير csrf/جلسة بيفشل.

4. **⚠️ مشكلة الـ auto-login (cross-origin):** bookbot على :3000، OMP على :8091.
   فكرة "auto-submit form بالباسورد في متصفح اليوزر" **مرفوضة** لأن المتصفح مش
   هيكون عنده جلسة OMP + csrf متطابق، ومنقدرش نقرا csrf بتاع OMP من أصل bookbot (CORS).
   → الدخول التلقائي محتاج واحد من اتنين (انظر قرار مرحلة 2).

**ملاحظة:** اتساب user تجريبي `testauthor_*` (id=2) في OMP المحلي — غير ضار.

### مرحلة 1 — إنشاء حساب المؤلف (backend)
- توسعة [user.model.ts](apps/api/src/models/user.model.ts): `ompUserId:number?`,
  `ompUsername:string?`, `ompPasswordEnc:string?` (select:false), `ompLinkedAt:Date?`.
- خدمة جديدة `services/omp/omp-author.service.ts`:
  - تولّد username (من الإيميل) + password عشوائي قوي.
  - تنشئ اليوزر في OMP بدور Author تحت `arado` (بالمسار المختار من مرحلة 0).
  - idempotent: لو اليوزر متربط بالفعل، ترجّع الحالة من غير تكرار.
  - تشفّر الـ password (مفتاح جديد `OMP_USER_SECRET` في env/zod).
- endpoint `POST /api/omp/author-account` (محمي بـ `requireAuth`) → ينشئ/يرجّع الربط.
- endpoint `GET /api/omp/author-account` → حالة الربط لليوزر الحالي.
- **DoD:** typecheck (`cd apps/api && pnpm exec tsc -p tsconfig.json --noEmit`)،
  واختبار حي: نداء الـendpoint بيعمل يوزر يظهر في admin UI بتاع OMP بدور Author.

### مرحلة 2 — الدخول على OMP (auto-login)
- endpoint `POST /api/omp/login-link` (محمي) → يرجّع وسيلة دخول تلقائي:
  - الطريقة الأساسية: صفحة وسيطة فيها auto-submit form لفورم لوجين OMP
    (`/index.php/arado/login/signIn`) ببيانات اليوزر (username + password مفكوك).
  - بديل لو فورم اللوجين محتاج CSRF: الخدمة تعمل sign-in من السيرفر وتمرّر الجلسة.
- **DoD:** ضغط الزرار → المستخدم داخل OMP مسجّل دخول من غير ما يكتب حاجة، وشايف
  زرار "New Submission" (دليل إن دور Author اتظبط صح).

### مرحلة 3 — الواجهة (apps/web)
- في صفحة البروفايل/الحساب: قسم "النشر مع آرادو".
  - لو مش مربوط: زرار **"فعّل حساب مؤلف"** → ينادي `POST /api/omp/author-account`.
  - بعد الربط: زرار **"ادخل على OMP"** → يفتح رابط الدخول التلقائي في تبويب جديد.
  - حالات: تحميل/خطأ/مربوط بالفعل.
- نصوص بالعربي والإنجليزي (اليوزر عنده `language`).
- **DoD:** التدفق كامل من الويب شغّال ضد OMP الحي.

### مرحلة 4 — تشطيب وتوثيق
- تحديث `apps/api` README و `.env.example` بالمتغيرات الجديدة
  (`OMP_USER_SECRET`، وأي admin creds لو مرحلة 0 احتاجتها).
- معالجة الأخطاء: OMP مش واصل، يوزر OMP موجود بالإيميل ده قبل كده، تعارض username.
- (اختياري لاحقاً) ترقية auto-login → SSO حقيقي عبر plugin.

---

## سجل التقدّم
- [x] مرحلة 0 — تحقق من API إنشاء اليوزر
- [x] مرحلة 1 — backend إنشاء الحساب ✅ (مُتحقّق حيّ: أنشأ OMP user id=3 من زرار bookbot، idempotent)
- [x] مرحلة 2 — auto-login عبر bookbotSso plugin في OMP ✅ (مُتحقّق حيّ end-to-end:
      `/api/omp/login-link` → جلسة OMP → dashboard 200؛ دور Author بيتسند تلقائياً؛
      التوكن المتلاعب فيه/المنتهي مرفوض)

#### تفاصيل تشغيل مرحلة 2 (مهمة للإعادة على بيئة جديدة)
- plugin: `omp/plugins/generic/bookbotSso/` (BookbotSsoPlugin + BookbotSsoHandler).
  بيوجّه `/<context>/bbsso/login?token=...`، يتحقق HMAC+exp، يفتح جلسة، يضمن دور Author.
- السر المشترك: `[bookbot] sso_secret` في `omp/config.inc.php` = `OMP_SSO_SECRET` في bookbot `.env`.
- تفعيل الـplugin (DB، مش في git — لازم يتعاد على بيئة جديدة):
  - `versions`: صف لـ `bookbotSso`/`BookbotSsoPlugin` (plugins.generic, current=1).
  - `plugin_settings`: `bookbotssoplugin`, context_id=1, enabled=1.
- بعد أي تعديل PHP: `docker compose build omp-app && up -d` + مسح `omp/cache/*.php` (opcache validate_timestamps=0).
- [ ] مرحلة 3 — واجهة الويب
- [ ] مرحلة 4 — تشطيب وتوثيق

**القاعدة:** ما نخلّص مرحلة (DoD + commit) حتى ندخل اللي بعدها. نحدّث السجل ده كل مرة.
