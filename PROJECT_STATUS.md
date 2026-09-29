# CareFlow working-model status

## Working in the current build

- Patient, doctor and administrator workspaces
- Patient and doctor registration, with new doctors awaiting administrator approval before they appear in booking
- Appointment booking, cancellation, priority/emergency booking, and live queue status changes
- Doctor availability controls, consultation notes, prescriptions and medicine reminders
- Health-record history and symptom-to-specialty recommendation (not a medical diagnosis)
- Department management, dispute resolution, CSV export and Chart.js analytics
- MongoDB Atlas persistence through the API at `http://localhost:8012/api`; browser storage is only an offline fallback

## Quick end-to-end check

1. Start the API with `npm.cmd run server` and confirm `MongoDB connected`.
2. Start the web app with `npm.cmd run dev` and open the Vite URL.
3. Sign in as `admin@careflow.com` / `admin123`, approve a pending doctor, then verify that doctor appears in patient booking.
4. Sign in as `patient@careflow.com` / `patient123`, book or cancel a slot, and verify the change in the doctor queue and admin analytics.
5. Add a consultation note or prescription as a doctor, then verify it in the patient health records/reminders.

## Final database migration

The existing demo document has been copied into the normalized collections. The migration is safe to rerun and leaves `demostates` untouched as a rollback backup:

```powershell
npm.cmd run migrate:demo-state
```

Verify the data in Atlas under `careflow`: `users`, `doctorprofiles`, `slots`, `appointments`, `healthrecords`, `reminders`, `prescriptions`, and `departments`. Imported users that did not already exist in the JWT database have a generated password hash and must use a password-reset flow before JWT login.

## Production work still required

The current UI uses a MongoDB-backed demo-state bridge so a final-year-project demonstration can share every action immediately. It is deliberately not a production security design. Before public hosting, switch the React UI to the existing normalized JWT API endpoints, protect every API route by role, move password handling fully server-side, add secure file/object storage for reports, and connect reminders to an approved push/SMS/email provider.

The server includes normalized MongoDB models and JWT endpoints to support that next phase. Add `GEMINI_API_KEY` to `.env` to enable the authenticated `/api/symptoms/recommend` and `/api/reports/analyze` endpoints; neither endpoint provides a medical diagnosis.
