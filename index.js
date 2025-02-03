const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
require("dotenv").config();

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require(process.env.FIREBASE_SERVICE_ACCOUNT)),
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

// 🚗 Vehicle Collection Reference
const vehiclesRef = db.collection("vehicles");

// 🟢 GET all vehicles
app.get("/vehicles", async (req, res) => {
  try {
    const snapshot = await vehiclesRef.get();
    const vehicles = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(vehicles);
  } catch (error) {
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
