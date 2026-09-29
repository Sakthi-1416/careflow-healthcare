import 'dotenv/config';
import mongoose from 'mongoose'; import bcrypt from 'bcryptjs';
import dns from 'node:dns';
import { User, DoctorProfile, Slot, Department, Appointment, HealthRecord, Reminder } from './models.js';
dns.setServers((process.env.DNS_SERVERS || '1.1.1.1,8.8.8.8').split(','));
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env first.');
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, family: 4 });
const accounts = [
  ['Aanya Sharma','patient@careflow.com','patient','patient123'],
  ['Dr. Meera Iyer','doctor@careflow.com','doctor','doctor123'],
  ['System Admin','admin@careflow.com','admin','admin123'],
  ['Dr. Arjun Rao','arjun@careflow.com','doctor','doctor123'],
];
for (const [fullName,email,role,password] of accounts) {
  const user = await User.findOneAndUpdate({email},{fullName,email,role,passwordHash:await bcrypt.hash(password,12)},{upsert:true,new:true,setDefaultsOnInsert:true});
  if (role === 'doctor') {
    const isPending = email === 'arjun@careflow.com';
    await DoctorProfile.findOneAndUpdate({user:user._id},{user:user._id,specialty:isPending?'Orthopedics':'General Medicine',experienceYears:isPending?7:12,fee:isPending?800:700,approved:!isPending},{upsert:true,new:true});
    for (const hour of [10,11,14,16]) { const date=new Date();date.setDate(date.getDate()+1);date.setHours(hour,0,0,0);await Slot.updateOne({doctor:user._id,startsAt:date},{$setOnInsert:{doctor:user._id,startsAt:date,durationMinutes:20,booked:false}},{upsert:true}); }
  }
}
for (const name of ['General Medicine', 'Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics', 'Neurology']) {
  await Department.updateOne({ name }, { $setOnInsert: { name, description: `${name} department`, active: true } }, { upsert: true });
}
const patient = await User.findOne({ email: 'patient@careflow.com' });
const doctor = await User.findOne({ email: 'doctor@careflow.com' });
const firstSlot = await Slot.findOne({ doctor: doctor._id }).sort('startsAt');
if (patient && doctor && firstSlot && !await Appointment.exists({ patient: patient._id })) {
  firstSlot.booked = true; await firstSlot.save();
  await Appointment.create({ patient: patient._id, doctor: doctor._id, slot: firstSlot._id, status: 'confirmed', predictedWaitMinutes: 18 });
  await HealthRecord.create({ patient: patient._id, doctor: doctor._id, category: 'encounter', title: 'Welcome consultation', content: 'Initial health profile review.' });
  await Reminder.create({ patient: patient._id, medicine: 'Vitamin D3', dose: '1 tablet', reminderTime: '08:00 AM' });
}
console.log('CareFlow demo data seeded.'); await mongoose.disconnect();
