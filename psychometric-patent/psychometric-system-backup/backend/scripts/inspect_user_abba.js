const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function run() {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/testing";
    console.log("Connecting to:", mongoUri);
    await mongoose.connect(mongoUri);

    const User = require("../models/User");
    const Enrollment = require("../models/Enrollment");

    const users = await User.find({ name: /abba/i });
    console.log("Matching Users:", users.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        rollNumber: u.rollNumber,
        branch: u.branch,
        profilePhoto: u.profilePhoto
    })));

    for (const u of users) {
        const enrs = await Enrollment.find({ candidateId: u._id });
        console.log(`Enrollments for user ${u.name} (${u._id}):`, JSON.stringify(enrs, null, 2));
    }

    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
