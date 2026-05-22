

const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// MongoDB setup
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
let usersCollection;
let tutorsCollection;
let bookingsCollection;

// SIMPLE TOKEN CHECK (basic)
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = { email: token }; // simple fake auth (replace later with JWT)
  next();
};

async function run() {
  try {
    await client.connect();

    db = client.db("tutor");
    usersCollection = db.collection("users");
    tutorsCollection = db.collection("booking");
    bookingsCollection = db.collection("bookings");

    console.log("🟢 MongoDB Connected");

    // =========================
    // AUTH ROUTES
    // =========================

    // REGISTER
    app.post("/api/auth/sign-up/email", async (req, res) => {
      try {
        const { name, email, password, role, image } = req.body;

        const exists = await usersCollection.findOne({ email });

        if (exists) {
          return res.status(400).json({ message: "User already exists" });
        }

        const result = await usersCollection.insertOne({
          name,
          email,
          password,
          role,
          image,
          createdAt: new Date(),
        });

        res.json({
          success: true,
          userId: result.insertedId,
        });
      } catch (err) {
        res.status(500).json({ message: "Registration failed" });
      }
    });

    // LOGIN
    app.post("/api/auth/sign-in/email", async (req, res) => {
      try {
        const { email, password } = req.body;

        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        if (user.password !== password) {
          return res.status(401).json({ message: "Wrong password" });
        }

        // simple token (email return)
        res.json({
          success: true,
          token: user.email,
          user,
        });
      } catch (err) {
        res.status(500).json({ message: "Login failed" });
      }
    });

    // SESSION
    app.get("/api/auth/get-session", (req, res) => {
      res.json({
        authenticated: false,
        user: null,
      });
    });

    // =========================
    // TUTOR ROUTES
    // =========================

    // ADD TUTOR
    app.post("/tutors", async (req, res) => {
      try {
        const newTutor = req.body;

        const result = await tutorsCollection.insertOne({
          ...newTutor,
          totalSlot: Number(newTutor.totalSlot),
          hourlyFee: Number(newTutor.hourlyFee),
          booked: false,
          createdAt: new Date(),
        });

        res.send({
          success: true,
          message: "Tutor added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({ message: "Failed to add tutor" });
      }
    });

    // GET ALL TUTORS
    app.get("/tutors", async (req, res) => {
      const search = req.query.search;

      const query = search
        ? {
            $or: [
              { tutorName: { $regex: search, $options: "i" } },
              { subject: { $regex: search, $options: "i" } },
            ],
          }
        : {};

      const result = await tutorsCollection.find(query).toArray();
      res.send(result);
    });

    // FEATURED
    app.get("/featured-tutors", async (req, res) => {
      const result = await tutorsCollection.find({}).limit(4).toArray();
      res.send(result);
    });

    // SINGLE TUTOR
    app.get("/tutors/:id", async (req, res) => {
      try {
        const result = await tutorsCollection.findOne({
          _id: new ObjectId(req.params.id),
        });

        if (!result) {
          return res.status(404).send({ message: "Tutor not found" });
        }

        res.send(result);
      } catch {
        res.status(500).send({ message: "Invalid ID" });
      }
    });

    // BOOK TUTOR
    app.patch("/tutors/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const data = req.body;

        const tutor = await tutorsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!tutor || tutor.totalSlot <= 0) {
          return res.status(400).send({
            success: false,
            message: "No slots available",
          });
        }

        await bookingsCollection.insertOne({
          tutorId: id,
          ...data,
          bookedAt: new Date(),
        });

        await tutorsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: { totalSlot: -1 },
            $set: { booked: true },
          }
        );

        res.send({
          success: true,
          message: "Booking successful",
        });
      } catch {
        res.status(500).send({ message: "Server error" });
      }
    });

    // BOOKINGS
    app.get("/bookings", verifyToken, async (req, res) => {
      try {
        const email = req.user.email;

        const result = await bookingsCollection
          .find({ studentEmail: email })
          .toArray();

        res.send(result);
      } catch {
        res.status(500).send({ message: "Failed to load bookings" });
      }
    });

    // DELETE BOOKING
    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      try {
        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(req.params.id),
        });

        if (!booking) {
          return res.status(404).send({ message: "Not found" });
        }

        await bookingsCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        await tutorsCollection.updateOne(
          { _id: new ObjectId(booking.tutorId) },
          { $inc: { totalSlot: 1 } }
        );

        res.send({
          success: true,
          message: "Deleted successfully",
        });
      } catch {
        res.status(500).send({ message: "Error" });
      }
    });

    app.listen(port, () =>
      console.log(`🚀 Server running on port ${port}`)
    );
  } catch (err) {
    console.log("DB ERROR:", err);
  }
}

run().catch(console.dir);

module.exports = app;

// const express = require("express");
// const dotenv = require("dotenv");
// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const cors = require("cors");
// const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

// dotenv.config();
// const app = express();
// const port = process.env.PORT || 8080;

// // CORS কনফিগারেশন - সব রিকোয়েস্ট পারমিট করার জন্য
// app.use(cors({
//   origin: "http://localhost:3000",
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"]
// }));
// app.use(express.json());

// const uri = process.env.MONGODB_URI;
// const client = new MongoClient(uri, {
//   serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
// });

// // JWT ভেরিফিকেশন মিডলওয়্যার
// const verifyToken = async (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   const token = authHeader?.split(" ")[1];

//   if (!token) return res.status(401).json({ message: "Unauthorized: No token" });

//   try {
//     // এখানে URL টি চেক করে নিন, .env এ CLIENT_URL থাকলে সেটি ব্যবহার করবে
//     const jwksUrl = new URL(`${process.env.CLIENT_URL || 'http://localhost:3000'}/api/auth/jwks`);
//     const currentJWKS = createRemoteJWKSet(jwksUrl);
//     const { payload } = await jwtVerify(token, currentJWKS);
//     req.user = payload;
//     next();
//   } catch (error) {
//     console.error("JWT Error:", error.message);
//     return res.status(401).json({ message: "Invalid token" });
//   }
// };

// async function run() {
//   try {
//     await client.connect();
//     const db = client.db("tutor");
//     const tutorsCollection = db.collection("booking");

//     // পাবলিক রাউট
//     app.get("/tutors", async (req, res) => {
//       const { search } = req.query;
//       let query = search ? { $or: [{ tutorName: { $regex: search, $options: "i" } }, { subject: { $regex: search, $options: "i" } }] } : {};
//       const result = await tutorsCollection.find(query).toArray();
//       res.send(result);
//     });

//     app.get("/featured-tutors", async (req, res) => {
//       try {
//         const result = await tutorsCollection.find({}).limit(4).toArray();
//         res.send(result);
//       } catch (error) { res.status(500).send({ message: error.message }); }
//     });

//     // সুরক্ষিত রাউট - verifyToken মিডলওয়্যারসহ
// const verifyToken = (req, res, next) => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader) {
//     return res.status(401).json({ message: "No token" });
//   }

//   const token = authHeader.split(" ")[1];

//   if (!token || token === "undefined") {
//     return res.status(401).json({ message: "Invalid token" });
//   }

//   try {
//     req.user = { token }; // simple pass
//     next();
//   } catch (err) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }
// };

//     console.log("🟢 Database Connected!");
//   } catch (error) { console.error("🔴 Database error:", error); }
// }

// run().catch(console.dir);
// app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
