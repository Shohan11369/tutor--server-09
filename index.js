const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 8080;
const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || "my_super_secret_key";

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

let bookingCollection;
let usersCollection;

async function startServer() {
  try {
    await client.connect();
    const database = client.db("tutor");
    bookingCollection = database.collection("booking");
    usersCollection = database.collection("users");
    console.log("🟢 Database Connected!");
  } catch (error) {
    console.error("🔴 DB Connection Failed:", error);
  }
}
startServer();


// GET ALL TUTORS

app.get("/tutors", async (req, res) => {
  try {
    const { search, startDate, endDate, limit } = req.query;
    let query = { tutorName: { $exists: true } };
    if (search) {
      query.$or = [
        { tutorName: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }
    if (startDate || endDate) {
      query.sessionStartDate = {};
      if (startDate) query.sessionStartDate.$gte = startDate;
      if (endDate) query.sessionStartDate.$lte = endDate;
    }
    let cursor = bookingCollection.find(query);
    if (limit) cursor = cursor.limit(parseInt(limit));
    const result = await cursor.toArray();
    res.send(result || []);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// ২. GET SINGLE TUTOR
app.get("/tutors/:id", async (req, res) => {
  try {
    const result = await bookingCollection.findOne({ _id: new ObjectId(req.params.id) });
    res.send(result || {});
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// ৩. BOOK SESSION
app.post("/bookings", async (req, res) => {
  try {
    const result = await bookingCollection.insertOne({ ...req.body, bookedAt: new Date() });
    await bookingCollection.updateOne({ _id: new ObjectId(req.body.tutorId) }, { $inc: { totalSlot: -1 } });
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// ৪. GET BOOKINGS
app.get("/bookings", async (req, res) => {
  try {
    const query = req.query.email ? { studentEmail: req.query.email } : {};
    const result = await bookingCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// ৫. ADD TUTOR
app.post("/tutors", async (req, res) => {
  try {
    const result = await bookingCollection.insertOne({ ...req.body, hourlyFee: parseFloat(req.body.hourlyFee), totalSlot: parseInt(req.body.totalSlot), createdAt: new Date() });
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// ৬. UPDATE TUTOR
app.put("/tutors/:id", async (req, res) => {
  try {
    const result = await bookingCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { hourlyFee: parseFloat(req.body.hourlyFee), totalSlot: parseInt(req.body.totalSlot), updatedAt: new Date() } });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// ৭. DELETE TUTOR
app.delete("/tutors/:id", async (req, res) => {
  try {
    const result = await bookingCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});


// AUTHENTICATION 


// REGISTER
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, photo, password } = req.body;
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists!" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await usersCollection.insertOne({ name, email, photo, password: hashedPassword, createdAt: new Date() });
    res.status(201).send({ message: "Registered successfully!", result });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// LOGIN
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await usersCollection.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials!" });
    }

    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    const { password: _, ...userData } = user;
    res.send({ message: "Login successful!", user: userData, token });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("MediQueue System Running...");
});

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));