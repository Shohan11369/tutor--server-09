const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const { betterAuth } = require("better-auth");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");

dotenv.config();
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

const port = process.env.PORT || 8080;
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true },
});


let bookingCollection;
let auth;

// Better Auth 
const authenticate = async (req, res, next) => {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.user = session.user; 
  next();
};

async function startServer() {
  try {
    
    await client.connect();
    console.log("🟢 Database Connected!");

    const database = client.db("tutor");
    bookingCollection = database.collection("booking");

    // Better Auth 
    auth = betterAuth({
      database: mongodbAdapter(client),
      baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8080",
      secret: process.env.BETTER_AUTH_SECRET,
      socialProviders: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      },
    });

    // Auth 
    app.use("/api/auth", async (req, res) => {
      return await auth.handler(req, res);
    });

    app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
  } catch (error) {
    console.error("🔴 Server Initialization Failed:", error);
  }
}

startServer();

// TUTORS API 
app.get("/tutors", async (req, res) => {
  try {
    const { search, limit } = req.query;
    let query = { tutorName: { $exists: true } };
    if (search) {
      query.$or = [
        { tutorName: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }
    let cursor = bookingCollection.find(query);
    if (limit) cursor = cursor.limit(parseInt(limit));
    const result = await cursor.toArray();
    res.send(result);
  } catch (error) { res.status(500).send({ message: error.message }); }
});

app.get("/tutors/:id", authenticate, async (req, res) => {
  try {
    const result = await bookingCollection.findOne({ _id: new ObjectId(req.params.id) });
    res.send(result || {});
  } catch (error) { res.status(500).send({ message: error.message }); }
});

// BOOKINGS API 
app.post("/bookings", authenticate, async (req, res) => {
  try {
    const result = await bookingCollection.insertOne({ ...req.body, bookedAt: new Date() });
    await bookingCollection.updateOne({ _id: new ObjectId(req.body.tutorId) }, { $inc: { totalSlot: -1 } });
    res.status(201).send(result);
  } catch (error) { res.status(500).send({ message: error.message }); }
});

app.get("/", (req, res) => res.send("MediQueue System Running..."));