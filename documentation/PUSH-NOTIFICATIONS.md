# Push notifications with Firebase (Phase 13)

Already working without Firebase: notifications are saved, shown in the student app's inbox, and pop up as in-app banners while the app is open (Socket.IO).

Firebase Cloud Messaging adds pushes when the app is closed. The backend part is done; it switches on when you give it a service account.

## Backend
1. Firebase console → create project → **Project settings → Service accounts → Generate new private key**.
2. Save the JSON as `backend/secrets/firebase.json` (the `secrets/` folder is git-ignored).
3. In `backend/.env`: `FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase.json`
4. `npm install` (installs the optional `firebase-admin`), restart. Log shows `[fcm] Firebase Cloud Messaging enabled.`

## Student app
1. Firebase console → **Add app → Android**, package `com.busmate.busmate_student`. Download `google-services.json` into `student-app/android/app/`.
2. Follow the FlutterFire setup (`dart pub global activate flutterfire_cli`, then `flutterfire configure`). It adds `firebase_options.dart` and the Gradle plugin.
3. `flutter pub add firebase_core firebase_messaging`
4. After login, request permission, get the token and send it to the backend:

```dart
await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
final fcm = FirebaseMessaging.instance;
await fcm.requestPermission();
final token = await fcm.getToken();
if (token != null) await session.api.put('/me/fcm-token', {'token': token});
fcm.onTokenRefresh.listen((t) => session.api.put('/me/fcm-token', {'token': t}));
```

The on/off switch in the student app's Settings already controls both in-app and push notifications.
