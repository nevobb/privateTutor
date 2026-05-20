# Local Tutor Start

Start by double-clicking:

`Start Tutor.command`

The launcher opens two Terminal windows:
- Firebase Emulators
- Next.js App

Alternative terminal command:

`npm run tutor:local`

Local URLs:
- App: http://localhost:3000
- Firebase Emulator UI: http://127.0.0.1:4000/

If it says ports are busy:
- close old tutor/emulator Terminal windows
- then double-click `Start Tutor.command` again

Stop:
- press `Ctrl+C` in each terminal window
- or close the terminal windows

Do not commit:
- `.env.local`
- `.next/`
- `firebase-debug.log`
- `firestore-debug.log`
- emulator data
- uploaded PDFs/DOCX
- `.claude/`
