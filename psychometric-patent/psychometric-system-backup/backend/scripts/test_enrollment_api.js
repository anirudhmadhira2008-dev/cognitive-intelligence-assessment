const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function run() {
    const secret = process.env.JWT_SECRET || "default_development_secret_key_32chars_min";
    const token = jwt.sign({ id: "6ae2103556027668a49b49ac", email: "abcd@gmail.com", role: "student" }, secret, { expiresIn: "1h" });
    console.log("Generated Token:", token);

    // Call GET /api/enrollment/my
    const fetch = globalThis.fetch || require("node-fetch");
    const myRes = await fetch("http://localhost:5000/api/enrollment/my", {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log("GET /api/enrollment/my Status:", myRes.status);
    const myData = await myRes.json();
    console.log("GET /api/enrollment/my Data:", JSON.stringify(myData, null, 2));

    if (myData.enrollments && myData.enrollments.length > 0) {
        const enr = myData.enrollments[0];
        const key = enr.identityEnrollment?.secureStorageKey;
        console.log("Found Storage Key:", key);
        if (key) {
            const imgRes = await fetch(`http://localhost:5000/api/enrollment/reference-image/${key}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("GET reference-image Status:", imgRes.status, "Content-Type:", imgRes.headers.get("content-type"), "Length:", imgRes.headers.get("content-length"));
        }
    }
}

run().catch(console.error);
