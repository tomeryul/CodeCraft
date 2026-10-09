# העלאה ל-App Store: הגדרה חד-פעמית

הצינור: `.github/workflows/ios-release.yml` מריץ את `fastlane/Fastfile` על runner של macOS.

| מה קורה | מה הוא עושה |
|---|---|
| push ל-`main` | בונה, חותם ומעלה build חדש ל-**TestFlight** |
| Actions ← iOS release ← Run workflow ← `beta` | אותו דבר, ידנית |
| Actions ← iOS release ← Run workflow ← `release` | בונה, מעלה **ושולח לבדיקה של App Store** |

רק `main` מעלה. ענף העבודה מקבל הרבה pushes ביום, ו-build לכל אחד היה קובר את זה ששווה לבדוק.

החתימה לא דורשת שום תעודה או פרופיל בריפו או בסודות. ‏xcodebuild חותם עם תעודת ההפצה ש-Apple מנהלת בענן, ומאמת את עצמו במפתח ה-API. לכן למפתח צריך תפקיד **Admin**.

עד שארבעת הסודות מוגדרים, ה-job מדלג בירוק עם הודעה ולא נכשל.

## 1. חשבון מפתח

- [Apple Developer Program](https://developer.apple.com/programs/): ‏99$ לשנה. בלי זה אין העלאה.
- **Team ID** (10 תווים): developer.apple.com ← Account ← Membership details.

## 2. רישום האפליקציה

1. **developer.apple.com** ← Certificates, Identifiers & Profiles ← Identifiers ← ＋
   - App IDs ← App
   - Bundle ID מסוג Explicit: `io.github.tomeryul.codecraft`
2. **App Store Connect** ← Apps ← ＋ New App
   - Platform: ‏iOS
   - Name: ‏`CodeCraft`. השם חייב להיות פנוי בחנות. אם הוא תפוס, נסה למשל "CodeCraft – Learn to Code".
   - Bundle ID: מה שנרשם בצעד 1
   - SKU: כל מחרוזת, למשל `codecraft`

## 3. מפתח App Store Connect API

App Store Connect ← Users and Access ← Integrations ← App Store Connect API ← Team Keys ← ＋

- Access: ‏**Admin**. זה מה שמאפשר חתימה בענן.
- הורד את קובץ ה-`.p8`. **אפשר להוריד אותו רק פעם אחת.**
- רשום את ה-**Key ID** (בשורה של המפתח) ואת ה-**Issuer ID** (מעל הטבלה).

## 4. סודות ב-GitHub

github.com/tomeryul/codecraft ← Settings ← Secrets and variables ← Actions ← New repository secret

| סוד | ערך |
|---|---|
| `ASC_KEY_ID` | ה-Key ID |
| `ASC_ISSUER_ID` | ה-Issuer ID |
| `ASC_KEY_P8` | כל התוכן של קובץ ה-`.p8`, כולל שורות ה-`BEGIN`/`END` |
| `APPLE_TEAM_ID` | ה-Team ID |

אחרי זה: Actions ← iOS release ← Run workflow ← `beta`. זה ייקח בערך 15–25 דקות. אחר כך ה-build מופיע ב-TestFlight אחרי עוד 10–30 דקות של עיבוד אצל Apple.

## 5. TestFlight

App Store Connect ← האפליקציה ← TestFlight ← Internal Testing ← ＋ ← הוסף את עצמך. מתקינים את אפליקציית TestFlight באייפון, וכל build חדש מ-`main` מגיע אליה לבד.

## 6. לפני ה-`release` הראשון

ה-lane `release` מעלה את הקובץ ושולח לבדיקה, אבל **לא** ממלא את דף החנות. את הדף ממלאים פעם אחת ב-App Store Connect:

- **תיאור ומילות מפתח.** אפשר בעברית ובאנגלית, לכל שפה בנפרד.
- **צילומי מסך:**
  - אייפון 6.9" (1320×2868)
  - אייפד 13" (2064×2752), כי האפליקציה רצה גם על אייפד
- **Support URL ו-Privacy Policy URL.** מדיניות פרטיות היא חובה, ובאפליקציה לילדים בודקים אותה במיוחד.
- **App Privacy.** השאלון על הנתונים שנאספים: אימייל וחשבון ב-Supabase, התקדמות במשחק.
- **Age Rating.**
- **Kids Category (אופציונלי).**
  - Apple מחמירה כאן: אין אנליטיקה או פרסום של צד שלישי, וכל קישור החוצה עובר דרך "שער הורים".
  - שער הגיל והמחיקה של החשבון כבר קיימים במשחק.
  - שווה לבדוק את הקישורים החוצה לפני שבוחרים בקטגוריה הזו.

כבר מוכן בפרויקט:
- הצהרת הצפנה (`ITSAppUsesNonExemptEncryption = false`), כך שאין שאלה בכל העלאה.
- privacy manifest.
- אייקון 1024 בלי שקיפות.
- `UIRequiresFullScreen` לאייפד.

אחרי ש-Apple מאשרת, האפליקציה **לא** יוצאת לבד (`automatic_release: false`). לוחצים Release ב-App Store Connect.

## מספרי גרסה

- **מספר ה-build** עולה לבד: אחד מעל הגבוה ביותר ש-App Store Connect ראה, כך שאף העלאה לא נדחית על מספר כפול.
- **הגרסה** (`1.0`): משנים ב-Xcode או ב-`MARKETING_VERSION` ב-`ios/App/App.xcodeproj/project.pbxproj` לפני כל גרסה חדשה לחנות.

## עלות

הריפו ציבורי, אז דקות ה-runner של macOS ב-GitHub Actions חינם. בריפו פרטי כל דקת macOS נספרת פי עשרה.
