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
const vehiclesRef = db.collection("vehicles");
const bookingsRef = db.collection("bookings");

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

// 🚀 **Vehicle Routes**
app.post("/vehicles/add", async (req, res) => {
  try {
    const { ownerId, images, name, plateNumber, model, fuelType, pricePerDay, location } = req.body;
    if (!ownerId || !images || images.length !== 4 || !name || !plateNumber || !model || !fuelType || !pricePerDay || !location) {
      return res.status(400).json({ error: "All fields are required, including 4 images." });
    }
    const vehicleData = {
      ownerId,
      images,
      name,
      plateNumber,
      model,
      fuelType,
      pricePerDay,
      location,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const newVehicle = await vehiclesRef.add(vehicleData);
    res.status(201).json({ message: "Vehicle added successfully", vehicleId: newVehicle.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/vehicles", async (req, res) => {
  try {
    const vehiclesSnapshot = await vehiclesRef.get();
    const vehicles = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🚀 **Booking Routes**
app.post("/bookings", async (req, res) => {
  try {
    const { renterId, vehicleId, pickupDate, returnDate } = req.body;
    if (!renterId || !vehicleId || !pickupDate || !returnDate) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const pickup = new Date(pickupDate);
    const returnD = new Date(returnDate);
    const duration = Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24)); // Convert to days

    const vehicleDoc = await vehiclesRef.doc(vehicleId).get();
    if (!vehicleDoc.exists) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    const pricePerDay = vehicleDoc.data().pricePerDay;
    const totalPrice = duration * pricePerDay;

    const bookingData = {
      renterId,
      vehicleId,
      pickupDate: pickup,
      returnDate: returnD,
      totalPrice,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    const newBooking = await bookingsRef.add(bookingData);
    res.status(201).json({ message: "Booking created successfully", bookingId: newBooking.id, totalPrice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));