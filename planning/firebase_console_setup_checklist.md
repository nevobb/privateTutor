# Firebase Console Setup Checklist

This checklist is for later manual setup. It does not mean Firebase has been connected to the app.

## 1. Manual Firebase console steps for later

- Create Firebase project.
- Enable Authentication.
- Enable Google provider or the chosen auth provider.
- Create Firestore database.
- Create Firebase Storage bucket.
- Confirm region.
- Confirm billing implications before enabling paid features.

## 2. Decisions Nevo must make

- Firebase project name.
- Google login only vs email/password too.
- Emulator-only first duration.
- Deployment target later.
- Storage size limits for MVP.

## 3. Explicit secret handling note

Do not paste secrets into GitHub or app files.

Do not commit:

- API keys
- service account keys
- private keys
- `.env`
- `.env.local`
- downloaded credential JSON files
- real Firebase project IDs in planning examples

## 4. Recommended manual order

1. Decide Firebase project name.
2. Decide auth provider for MVP.
3. Decide MVP storage size limits.
4. Decide emulator-only validation period.
5. Create cloud project only after emulator scaffolding is reviewed.
6. Keep runtime code pointed at mocks until a separate Firebase connection task is approved.
