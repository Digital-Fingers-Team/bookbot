# تشغيل OMP (Open Monograph Press) عبر Docker وربطه بـ API الموقع

## نظرة عامة
OMP تطبيق PHP/MySQL كامل ومستقل. بنشغّله في حاوية Docker خاصة بيه، وموقع
bookbot (Next.js) بيكلّمه عن طريق الـ REST API بتاع OMP.

- **واجهة OMP:** http://localhost:8081
- **قاعدة البيانات:** MariaDB (حاوية `omp-db`) — اسم القاعدة `omp`، المستخدم `omp`، الباسورد `omp_pass`
- **الكود:** الحزمة الرسمية الكاملة متفكوكة في `../omp`

## خطوات التشغيل (مرة واحدة)
1. تأكد إن مجلد `../omp` فيه الحزمة الكاملة (وفيه `lib/pkp`).
2. من داخل مجلد `omp-docker`:
   ```
   docker compose up -d --build
   ```
3. افتح المتصفح على http://localhost:8081 وكمّل صفحة التثبيت (Installation):
   - **Database driver:** MySQLi
   - **Host:** `omp-db`
   - **Database name:** `omp`
   - **Username:** `omp`
   - **Password:** `omp_pass`
   - سيب باقي القيم الافتراضية واضغط Install.
4. بعد التثبيت، OMP جاهز.

## تفعيل الـ REST API (للربط بموقعك)
OMP عنده REST API جاهز تحت المسار:
```
http://localhost:8081/index.php/<press_path>/api/v1/...
```
لإنشاء API token لمستخدم:
- ادخل بحساب أدمن → User profile → API Key → فعّل وانسخ المفتاح.
- موقع bookbot يستخدم المفتاح ده في هيدر:
  `Authorization: Bearer <API_KEY>`

أمثلة Endpoints:
- قائمة المنشورات/الإصدارات: `GET /api/v1/submissions`
- بيانات منشور: `GET /api/v1/submissions/{id}`
- الكتالوج العام (واجهة): متاح بدون توكن على صفحات الكتالوج.

## أوامر مفيدة
- إيقاف: `docker compose down`
- لوجز التطبيق: `docker compose logs -f omp-app`
- لوجز القاعدة: `docker compose logs -f omp-db`
