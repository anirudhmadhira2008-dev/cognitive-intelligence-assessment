const mongoose = require("mongoose");

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        console.warn("⚠️ MONGO_URI not provided. Starting in development sandbox mode.");
        return null;
    }

    try {
        const connection = await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 7000
        });

        console.log(`✅ MongoDB Connected Successfully: ${connection.connection.host}/${connection.connection.name}`);
        return connection;
    } catch (error) {
        console.error(`❌ MongoDB Connection Failed: ${error.message}`);
        console.warn("⚠️ Development mode: continuing with in-memory sandbox fallbacks.");
        return null;
    }
};

module.exports = connectDB;