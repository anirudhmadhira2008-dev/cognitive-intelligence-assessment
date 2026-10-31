const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const bcrypt = require('../node_modules/bcryptjs');

const uri = 'mongodb+srv://AnirudhMadhira:372825@cluster0.wiw5lv2.mongodb.net/testing?retryWrites=true&w=majority';

async function seedAdmin() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const email = 'admin@vnrvjiet.in';
    const password = 'Admin@2026!';
    const passwordHash = await bcrypt.hash(password, 12);

    const updateDoc = {
      $set: {
        name: 'System Administrator',
        email: email,
        password: passwordHash,
        role: 'admin',
        rollNumber: 'ADMIN01',
        college: 'VNRVJIET',
        course: 'Administration',
        branch: 'Management',
        year: '4',
        phone: '9999999999',
        isActive: true,
        accountStatus: 'active',
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    };

    const res = await db.collection('users').updateOne(
      { email: email },
      updateDoc,
      { upsert: true }
    );

    console.log('Admin account written to MongoDB Atlas:', res);

    const adminUser = await db.collection('users').findOne({ email: email });
    const match = await bcrypt.compare(password, adminUser.password);
    console.log(`Password verification check: ${match ? 'SUCCESS (Password matches!)' : 'FAILURE'}`);
    console.log(`Admin User ID: ${adminUser._id}, Email: ${adminUser.email}, Role: ${adminUser.role}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error during admin seeding:', err);
  }
}

seedAdmin();
