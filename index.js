
const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
require("dotenv").config();
const fs = require("fs");


// ✅ Load Firebase service account JSON securely
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

// ✅ Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth(); // ✅ Firebase Authentication
const usersRef = db.collection("users");

const app = express();
app.use(cors()); // Enable CORS
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Supports form-encoded requests

// 🚀 **User Registration**
app.post("/register", async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // ✅ Check if username already exists
    const usernameQuery = await usersRef.where("username", "==", username).get();
    if (!usernameQuery.empty) {
      return res.status(400).json({ error: "Username already exists." });
    }

    // ✅ Create user in Firebase Authentication
    const newUser = await auth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });

    // ✅ Send Firebase Default Email Verification
    const user = await auth.getUserByEmail(email);
    await auth.generateEmailVerificationLink(email);

    // ✅ Save user details to Firestore
    await usersRef.doc(newUser.uid).set({
      uid: newUser.uid,
      username,
      email: newUser.email,
      firstName,
      lastName,
      emailVerified: false, // Initially false, should be updated after verification
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      message: "User registered successfully. Check your email for verification.",
      uid: newUser.uid,
    });

  } catch (error) {
    console.error("Registration Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🚀 **Resend Email Verification**
app.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await auth.getUserByEmail(email);

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    const verificationLink = await auth.generateEmailVerificationLink(email);
    console.log(`Email verification link: ${verificationLink}`);

    res.json({ message: "Verification email sent successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});





// 🔐 **Login (Supports Username or Email)**
app.post("/login", async (req, res) => {
  try {
    console.log("Login Attempt:", req.body); // Debugging

    const { usernameOrEmail, password } = req.body;

    // ✅ Validate required fields
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: "Username/Email and password are required" });
    }

    let userDoc;
    if (usernameOrEmail.includes("@")) {
      // ✅ Login using email
      const userRecord = await auth.getUserByEmail(usernameOrEmail);
      userDoc = await usersRef.doc(userRecord.uid).get();
    } else {
      // ✅ Login using username
      const usernameQuery = await usersRef.where("username", "==", usernameOrEmail).limit(1).get();
      if (usernameQuery.empty) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      userDoc = usernameQuery.docs[0];
    }

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found in database" });
    }

    const userData = userDoc.data();

    // ✅ Check if email is verified
    if (!userData.emailVerified) {
      return res.status(403).json({ error: "Email not verified. Please verify your email first." });
    }

    res.json({
      message: "Login successful",
      user: {
        uid: userData.uid,
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        createdAt: userData.createdAt,
        emailVerified: userData.emailVerified,
      },
    });

  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});





// 🚗 Vehicle Collection Reference
const vehiclesRef = db.collection("vehicles");

// 🟢 GET all vehicles
app.get("/vehicles", async (req, res) => {
  try {
    console.log("Fetching vehicles from Firestore...");
    const snapshot = await vehiclesRef.get();

    if (snapshot.empty) {
      console.log("No vehicles found!");
      return res.status(404).json({ error: "No vehicles available" });
    }

    const vehicles = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    console.log("Vehicles found:", vehicles); // 🔍 Log fetched vehicles
    res.json(vehicles);
  } catch (error) {
    console.error("Error fetching vehicles:", error.message);
    res.status(500).json({ error: error.message });
  }
});


// 🟢 GET a single vehicle by ID
app.get("/vehicles/:id", async (req, res) => {
  try {
    const vehicleDoc = await vehiclesRef.doc(req.params.id).get();
    if (!vehicleDoc.exists) return res.status(404).json({ error: "Vehicle not found" });

    res.json({ id: vehicleDoc.id, ...vehicleDoc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔵 POST (Add a new vehicle)
app.post("/vehicles", async (req, res) => {
  try {
    const { name, type, price, location } = req.body;
    const newVehicle = await vehiclesRef.add({ name, type, price, location, available: true });
    res.status(201).json({ id: newVehicle.id, message: "Vehicle added successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🟠 UPDATE a vehicle
app.put("/vehicles/:id", async (req, res) => {
  try {
    await vehiclesRef.doc(req.params.id).update(req.body);
    res.json({ message: "Vehicle updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔴 DELETE a vehicle
app.delete("/vehicles/:id", async (req, res) => {
  try {
    await vehiclesRef.doc(req.params.id).delete();
    res.json({ message: "Vehicle deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🚘 Booking a Vehicle
app.post("/bookings", async (req, res) => {
  try {
    const { userId, vehicleId, startDate, endDate } = req.body;

    const vehicleRef = vehiclesRef.doc(vehicleId);
    const vehicle = await vehicleRef.get();

    if (!vehicle.exists || !vehicle.data().available) {
      return res.status(400).json({ error: "Vehicle is not available" });
    }

    // Create a booking
    const bookingRef = db.collection("bookings").doc();
    await bookingRef.set({ userId, vehicleId, startDate, endDate });

    // Update vehicle availability
    await vehicleRef.update({ available: false });

    res.json({ message: "Booking confirmed", bookingId: bookingRef.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

  // Start Server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
