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
    origin: `${process.env.CLIENT_URL}`,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
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

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
    );

    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;
    next();
  } catch (error) {
    console.log("JWT ERROR:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
};

// MAIN
async function run() {
  try {
    await client.connect();

    const db = client.db("tutor");
    const tutorsCollection = db.collection("booking");
    const bookingsCollection = db.collection("bookings");

    console.log("🟢 MongoDB Connected");

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
        console.log(error);
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
      } catch (error) {
        res.status(500).send({ message: "Invalid ID" });
      }
    });

    // BOOK TUTOR
    app.patch("/tutors/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        const tutor = await tutorsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!tutor || tutor.totalSlot <= 0) {
          return res.status(400).send({
            success: false,
            message: "No slots available",
          });
        }

        const data = req.body;

        await bookingsCollection.insertOne({
          tutorId: id,
          studentName: data.studentName,
          studentEmail: data.studentEmail,
          tutorName: data.tutorName,
          tutorPhoto: data.tutorPhoto,
          subject: data.subject,
          hourlyFee: data.hourlyFee,
          confirmNumber: data.confirmNumber,
          bookedAt: new Date(),
        });

        const result = await tutorsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              studentName: data.studentName,
              studentEmail: data.studentEmail,
              tutorName: data.tutorName,
              tutorPhoto: data.tutorPhoto,
              subject: data.subject,
              hourlyFee: data.hourlyFee,
              booked: true,
              bookedAt: new Date(),
            },
            $inc: { totalSlot: -1 },
          },
        );

        res.send({
          success: true,
          message: "Booking successful",
          result,
        });
      } catch (error) {
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
      } catch (error) {
        res.status(500).send({ message: "Failed to load bookings" });
      }
    });

    // DELETE BOOKING
    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      try {
        const bookingId = req.params.id;

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(bookingId),
        });

        if (!booking) {
          return res.status(404).send({ message: "Booking not found" });
        }

        await bookingsCollection.deleteOne({
          _id: new ObjectId(bookingId),
        });

        await tutorsCollection.updateOne(
          { _id: new ObjectId(booking.tutorId) },
          { $inc: { totalSlot: 1 } },
        );

        res.send({
          success: true,
          message: "Booking cancelled successfully",
        });
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });

    app.get("/", (req, res) => {
  res.send("MediQueue Server Running");
});

    app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
  } catch (error) {
    console.log("DB ERROR:", error);
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
