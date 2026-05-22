const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(
  cors({
    origin: "https://tutor-front-end-09.vercel.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// MONGO SETUP
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// JWT VERIFY
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
    );

    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// MAIN ROUTE SETUP (ডাটাবেস কানেকশন হ্যান্ডেল করা)
async function setupServer() {
  await client.connect();
  const db = client.db("tutor");
  // নিশ্চিত হোন আপনার কালেকশনের নাম 'booking' নাকি 'tutors'
  const tutorsCollection = db.collection("booking"); 
  const bookingsCollection = db.collection("bookings");

  console.log("🟢 MongoDB Connected");

  // ADD TUTOR
  app.post("/tutor", async (req, res) => {
    try {
      const newTutor = req.body;
      const result = await tutorsCollection.insertOne({
        ...newTutor,
        totalSlot: Number(newTutor.totalSlot),
        hourlyFee: Number(newTutor.hourlyFee),
        booked: false,
        createdAt: new Date(),
      });
      res.send({ success: true, insertedId: result.insertedId });
    } catch (error) {
      res.status(500).send({ message: "Failed to add" });
    }
  });

  // GET ALL TUTORS
  app.get("/tutor", async (req, res) => {
    const search = req.query.search;
    const query = search ? { $or: [{ tutorName: { $regex: search, $options: "i" } }, { subject: { $regex: search, $options: "i" } }] } : {};
    const result = await tutorsCollection.find(query).toArray();
    res.send(result);
  });

  // SINGLE TUTOR
  app.get("/tutor/:id", async (req, res) => {
    try {
      const result = await tutorsCollection.findOne({ _id: new ObjectId(req.params.id) });
      result ? res.send(result) : res.status(404).send({ message: "Not found" });
    } catch (error) {
      res.status(500).send({ message: "Invalid ID" });
    }
  });

  // PATCH (BOOKING)
  app.patch("/tutor/:id", verifyToken, async (req, res) => {
    try {
      const id = req.params.id;
      const data = req.body;
      await bookingsCollection.insertOne({ tutorId: id, ...data, bookedAt: new Date() });
      await tutorsCollection.updateOne({ _id: new ObjectId(id) }, { $set: { booked: true }, $inc: { totalSlot: -1 } });
      res.send({ success: true });
    } catch (error) {
      res.status(500).send({ message: "Server error" });
    }
  });

  // BOOKINGS GET & DELETE (একইভাবে এখানে রাখুন)
  app.get("/bookings", verifyToken, async (req, res) => {
    const result = await bookingsCollection.find({ studentEmail: req.user.email }).toArray();
    res.send(result);
  });

  app.delete("/bookings/:id", verifyToken, async (req, res) => {
    await bookingsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.send({ success: true });
  });
}

setupServer().catch(console.dir);

// ভেরসেল এর জন্য এক্সপোর্ট
module.exports = app;

// লোকালহোস্টে চালানোর জন্য
if (require.main === module) {
  app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
}