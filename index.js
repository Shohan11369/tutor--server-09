const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

/* =========================
   MONGO SETUP
========================= */

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/* =========================
   LOGGER (same pattern)
========================= */

const logger = (req, res, next) => {
  console.log(`${req.method} | ${req.url}`);
  next();
};

/* =========================
   JWT VERIFY (SIMPLE FIXED)
========================= */

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).send({ message: "Invalid token" });
  }
};

/* =========================
   MAIN SERVER
========================= */

async function run() {
  try {
    await client.connect();

    const db = client.db("tutor");

    const tutorsCollection = db.collection("tutors");
    const bookingsCollection = db.collection("bookings");

    console.log("🟢 MongoDB Connected");

/* =========================
   GET ALL TUTORS (LIKE COURSES)
========================= */

    app.get("/tutors", async (req, res) => {
      const { search } = req.query;

      let query = {};

      if (search) {
        query = {
          $or: [
            { tutorName: { $regex: search, $options: "i" } },
            { subject: { $regex: search, $options: "i" } },
          ],
        };
      }

      const result = await tutorsCollection.find(query).toArray();
      res.send(result);
    });

/* =========================
   FEATURED (LIKE /featured)
========================= */

    app.get("/featured-tutors", async (req, res) => {
      const result = await tutorsCollection.find().limit(4).toArray();
      res.send(result);
    });

/* =========================
   SINGLE TUTOR (LIKE /courses/:id)
========================= */

    app.get("/tutors/:id", logger, async (req, res) => {
      try {
        const id = req.params.id;

        const result = await tutorsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).send({ message: "Tutor not found" });
        }

        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Invalid ID" });
      }
    });

/* =========================
   BOOK TUTOR (LIKE PATCH ENROLLMENT)
========================= */

    app.patch("/tutors/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;

      const tutor = await tutorsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!tutor) {
        return res.status(404).send({ message: "Tutor not found" });
      }

      if (tutor.totalSlot <= 0) {
        return res.status(400).send({ message: "No slots available" });
      }

      // insert booking
      const booking = {
        tutorId: id,
        studentName: data.studentName,
        studentEmail: data.studentEmail,
        tutorName: data.tutorName,
        subject: data.subject,
        hourlyFee: data.hourlyFee,
        confirmNumber: data.confirmNumber,
        bookedAt: new Date(),
      };

      await bookingsCollection.insertOne(booking);

      // update tutor
      await tutorsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $inc: { totalSlot: -1 },
          $set: {
            booked: true,
            lastBookedAt: new Date(),
          },
        }
      );

      res.send({ success: true, message: "Booking successful" });
    });

/* =========================
   MY BOOKINGS (LIKE ENROLLMENTS)
========================= */

    app.get("/bookings/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      const result = await bookingsCollection
        .find({ studentEmail: email })
        .toArray();

      res.send(result);
    });

/* =========================
   DELETE BOOKING (LIKE REMOVE ENROLL)
========================= */

    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!booking) {
        return res.status(404).send({ message: "Not found" });
      }

      await bookingsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      await tutorsCollection.updateOne(
        { _id: new ObjectId(booking.tutorId) },
        { $inc: { totalSlot: 1 } }
      );

      res.send({ success: true, message: "Deleted successfully" });
    });

    console.log("🚀 Server ready");
  } finally {
    // keep alive
  }
}

run().catch(console.dir);

/* =========================
   ROOT
========================= */

app.get("/", (req, res) => {
  res.send("Tutor API running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

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
