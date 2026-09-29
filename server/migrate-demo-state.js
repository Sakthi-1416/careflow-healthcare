import 'dotenv/config';
import crypto from 'node:crypto';
import dns from 'node:dns';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Appointment, Department, DoctorProfile, HealthRecord, Reminder, Prescription, Slot, SymptomAssessment, User, DemoState } from './models.js';

dns.setServers((process.env.DNS_SERVERS || '1.1.1.1,8.8.8.8').split(','));
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env first.');

const date = value => value ? new Date(value) : new Date();
const category = value => value === 'Encounter' ? 'encounter' : value === 'Lab report' ? 'lab_report' : 'prescription';

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, family: 4 });
try {
  const demo = await DemoState.findOne({ key: 'primary' }).lean();
  if (!demo?.state) throw new Error('No primary demo state was found.');
  const state = demo.state;
  const usersByLegacyId = new Map();
  let importedUsers = 0;

  for (const source of state.users || []) {
    const email = String(source.email || '').toLowerCase();
    if (!email) continue;
    let user = await User.findOne({ email });
    if (!user) {
      // Demo-state intentionally stores no passwords. Imported accounts require password reset before JWT login.
      user = await User.create({
        fullName: source.name || 'Imported user', email, role: source.role,
        passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
        bloodGroup: source.blood, allergies: source.allergies, chronicConditions: source.chronicConditions,
      });
      importedUsers += 1;
    } else {
      user.fullName = source.name || user.fullName;
      user.bloodGroup = source.blood || user.bloodGroup;
      user.allergies = source.allergies || user.allergies;
      user.chronicConditions = source.chronicConditions || user.chronicConditions;
      await user.save();
    }
    usersByLegacyId.set(source.id, user);
    if (source.role === 'doctor') {
      await DoctorProfile.findOneAndUpdate(
        { user: user._id },
        { user: user._id, specialty: source.specialty || 'General Medicine', fee: source.fee || 0, approved: Boolean(source.approved) },
        { upsert: true, new: true },
      );
    }
  }

  const slotsByLegacyId = new Map();
  let importedSlots = 0;
  for (const source of state.slots || []) {
    const doctor = usersByLegacyId.get(source.doctor);
    if (!doctor || !source.at) continue;
    let slot = await Slot.findOne({ doctor: doctor._id, startsAt: date(source.at) });
    if (!slot) { slot = await Slot.create({ doctor: doctor._id, startsAt: date(source.at), booked: Boolean(source.booked) }); importedSlots += 1; }
    else { slot.booked = Boolean(source.booked); await slot.save(); }
    slotsByLegacyId.set(source.id, slot);
  }

  const appointmentsByLegacyId = new Map();
  let importedAppointments = 0;
  for (const source of state.appointments || []) {
    const patient = usersByLegacyId.get(source.patient), doctor = usersByLegacyId.get(source.doctor), slot = slotsByLegacyId.get(source.slot);
    if (!patient || !doctor || !slot) continue;
    let appointment = await Appointment.findOne({ patient: patient._id, doctor: doctor._id, slot: slot._id });
    if (!appointment) {
      appointment = await Appointment.create({ patient: patient._id, doctor: doctor._id, slot: slot._id, status: source.status || 'confirmed', emergency: Boolean(source.priority), predictedWaitMinutes: source.wait, createdAt: date(source.created) });
      importedAppointments += 1;
    } else {
      appointment.status = source.status || appointment.status;
      appointment.emergency = Boolean(source.priority);
      appointment.predictedWaitMinutes = source.wait ?? appointment.predictedWaitMinutes;
      await appointment.save();
    }
    appointmentsByLegacyId.set(source.id, appointment);
  }

  let importedRecords = 0, importedReminders = 0, importedPrescriptions = 0, importedSymptoms = 0;
  for (const source of state.records || []) {
    const patient = usersByLegacyId.get(source.patient);
    if (!patient) continue;
    const exists = await HealthRecord.exists({ patient: patient._id, title: source.title, content: source.detail });
    if (!exists) { await HealthRecord.create({ patient: patient._id, category: category(source.type), title: source.title, content: source.detail, createdAt: date(source.created) }); importedRecords += 1; }
  }
  for (const source of state.reminders || []) {
    const patient = usersByLegacyId.get(source.patient);
    if (!patient) continue;
    const existing = await Reminder.findOne({ patient: patient._id, medicine: source.medicine, reminderTime: source.time });
    if (!existing) { await Reminder.create({ patient: patient._id, medicine: source.medicine, dose: source.dose, reminderTime: source.time, active: source.active !== false }); importedReminders += 1; }
    else { existing.active = source.active !== false; await existing.save(); }
  }
  for (const source of state.prescriptions || []) {
    const patient = usersByLegacyId.get(source.patient);
    const appointment = [...appointmentsByLegacyId.values()].find(item => item.patient.equals(patient?._id));
    if (!patient || !appointment) continue;
    const exists = await Prescription.exists({ patient: patient._id, notes: source.notes, 'medicines.name': source.medicine });
    if (!exists) { await Prescription.create({ patient: patient._id, doctor: appointment.doctor, appointment: appointment._id, medicines: [{ name: source.medicine, dose: source.dose, schedule: source.time }], notes: source.notes, createdAt: date(source.created) }); importedPrescriptions += 1; }
  }
  for (const source of state.symptoms || []) {
    const patient = usersByLegacyId.get(source.patient);
    if (!patient || !source.text) continue;
    const exists = await SymptomAssessment.exists({ patient: patient._id, symptoms: source.text });
    if (!exists) { await SymptomAssessment.create({ patient: patient._id, symptoms: source.text, recommendedSpecialty: source.specialty || 'General Medicine', message: 'Imported specialty recommendation. Not a diagnosis.', provider: 'local-demo', createdAt: date(source.created) }); importedSymptoms += 1; }
  }
  for (const name of state.departments || []) await Department.updateOne({ name }, { $setOnInsert: { name, description: `${name} department`, active: true } }, { upsert: true });

  console.log(JSON.stringify({ importedUsers, importedSlots, importedAppointments, importedRecords, importedReminders, importedPrescriptions, importedSymptoms, departments: (state.departments || []).length }, null, 2));
  console.log('Migration completed. DemoState was retained as a rollback backup.');
} finally {
  await mongoose.disconnect();
}
