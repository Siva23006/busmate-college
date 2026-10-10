# BusMate: always-on server + Firebase login

## Part A: Firebase (login security, forgot password, phone notifications)
1. console.firebase.google.com → Create project → name `busmate-alerts` (NEW project, Analytics off). Plan stays **Spark (free)**.
2. Build → **Authentication** → Get started → **Email/Password** → Enable → Save.
3. Authentication → **Templates** → Password reset → edit: sender name `BusMate by Nexi Net` → Save.
4. Project settings (⚙) → General → **Web API key** → copy. (If none is shown: "Add app" → Web `</>` → name `busmate-server` → Register; the key appears.)
5. Project settings → **Service accounts** → Generate new private key → open the JSON in Notepad → copy ALL of it. Keep the file private.
6. (Phone notifications) Add Android app `com.busmate.busmate_student` → download `google-services.json` → `student-app/android/app/`.

Server environment variables (Northflank or Render):
- `FIREBASE_SERVICE_ACCOUNT` = the whole service-account JSON
- `FIREBASE_WEB_API_KEY` = the Web API key

How it works: users keep logging in with their ID (DRV001 / student ID / admin email). The server finds the
account's email and Firebase checks the password. Existing users are moved to Firebase automatically the first
time they log in. "Forgot password?" emails a Firebase reset link (needs an email on the account; set it in
admin → Drivers/Students → Edit). Accounts without email keep working; the admin resets their password.

## Part B: Always-on server (Northflank, free Sandbox, never sleeps)
1. northflank.com → Sign up with GitHub (card is only verified, not charged on Sandbox).
2. Create project → name `busmate`, region **Asia**.
3. Create new → **Service** → **Combined service**:
   - Repository `Siva23006/busmate-college`, branch `main`
   - Build type **Dockerfile**, Dockerfile path `/Dockerfile`, build context `/`
   - Plan: the free Sandbox plan
   - Networking: port `4000`, protocol HTTP, **Public** on
   - Health check: HTTP `/api/health` on port 4000 (optional)
4. Environment → Runtime variables (copy from Render):
   `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS=https://busmate-college.vercel.app,http://localhost:3000`,
   `DATABASE_SSL=true`, `ALLOW_SIMULATION=false`, `APP_TIME_ZONE=Asia/Kolkata`, `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_WEB_API_KEY`
5. Create → wait for the build → copy the public URL (looks like `https://p01--busmate-api--xxxx.code.run`).
6. Open `<URL>/api/health` → should show `"status":"ok"`.

Point everything to the new URL:
- Vercel → Settings → Environment Variables → `NEXT_PUBLIC_API_URL` = new URL → Deployments → Redeploy.
- `driver-app/lib/core/config.dart` and `student-app/lib/core/config.dart` → `productionApiUrl` = new URL → `flutter run` / rebuild APKs.
- When everything works on Northflank, suspend the Render service (Render → Settings → Suspend).
