# Free deployment: backend on Render, admin on Vercel, apps without IP addresses

After this, everything talks to one online address and works on any network:

```
Driver app ─┐
Student app ├──► https://busmate-api.onrender.com  (Render, free) ──► Neon database (free)
Admin portal┘     https://<your-name>.vercel.app   (Vercel, free)
```

Free-plan note: Render's free backend sleeps after 15 minutes with no traffic and takes about
a minute to wake. During a trip the driver app keeps it awake. The apps wait up to 60 seconds,
so the first login after a quiet period is slow but works.

---

## Step 0. Update the database (once, from your laptop)

```
cd backend
npm run db:migrate
```
Applies `003_trip_locations.sql` (start/end location of each trip for Track Bus).

## Step 1. Put the project on GitHub (private)

1. https://github.com → **New repository** → name `busmate-college` → **Private** → Create (no README).
2. In the VS Code terminal, in the main `BUSMATE-COLLEGE` folder:
   ```
   git init
   git add .
   git status
   ```
   **Check:** the list must NOT contain `backend/.env`, `admin-dashboard/.env.local`
   or any `local.properties`. The `.gitignore` keeps them out. If you see them, stop and ask.
   ```
   git commit -m "BusMate"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/busmate-college.git
   git push -u origin main
   ```

## Step 2. Backend on Render

1. https://render.com → sign up **with GitHub**.
2. **New → Blueprint** → pick `busmate-college`. Render reads `render.yaml`.
3. Fill the 3 values it asks for:
   - `DATABASE_URL` = same as in `backend/.env`
   - `JWT_SECRET` = same as in `backend/.env`
   - `CORS_ORIGINS` = `http://localhost:3000` for now
4. **Apply**. Wait until it shows **Live** (3-5 min).
5. Copy the address at the top, e.g. `https://busmate-api.onrender.com`.

**Check:** `https://busmate-api.onrender.com/api/health` shows `"database":"ok"`.

**If your address is different** from `https://busmate-api.onrender.com` (Render adds letters
when the name is taken), open `driver-app/lib/core/config.dart` and
`student-app/lib/core/config.dart` and change `productionApiUrl` to your address.

## Step 3. Admin portal on Vercel

1. https://vercel.com → sign up **with GitHub** → **Add New → Project** → import `busmate-college`.
2. **Root Directory** → `admin-dashboard`.
3. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = your Render address
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` = the dashboard key (same as in `.env.local`)
4. **Deploy**. Note the address, e.g. `https://busmate-college.vercel.app`.

## Step 4. Connect them

1. **Render** → busmate-api → **Environment** → `CORS_ORIGINS`:
   ```
   https://busmate-college.vercel.app,http://localhost:3000
   ```
   (your real Vercel address, comma, no spaces) → Save.
2. **Google Cloud** → Keys & Credentials → **Maps Platform API Key** → Websites → **Add**:
   ```
   https://busmate-college.vercel.app/*
   ```
   → Save (takes ~5 minutes).
3. Open your Vercel address and log in.

## Step 5. Phone apps (no IP needed any more)

The apps now use the online backend by default:

```
cd driver-app
flutter run
```
```
cd student-app
flutter run
```

Installable APK files to share with drivers and students:

```
flutter build apk --release
```
File: `build/app/outputs/flutter-apk/app-release.apk`.
Note: a release build is signed with a different key than debug builds. Add the release SHA-1 to
the **BusMate android** key in Google Cloud (get it with `cd android` then `.\gradlew signingReport`,
section `Variant: release`), or the map stays grey in the APK.

Still want the laptop backend for testing? `flutter run --dart-define=API_URL=http://192.168.1.7:4000`

## Updating later

```
git add .
git commit -m "what changed"
git push
```
Render and Vercel redeploy automatically. New database migrations: `cd backend` → `npm run db:migrate`.
