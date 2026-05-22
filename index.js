const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// ================= MIDDLEWARE =================
app.use(
  cors({
    origin: "https://tutor-front-end-09.vercel.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("Tutor Server Running");
});

// ================= MONGO =================
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ⚡ GLOBAL COLLECTIONS (IMPORTANT FIX FOR VERCEL)
let tutorsCollection;
let bookingsCollection;

// connect once
client
  .connect()
  .then(() => {
    const db = client.db("tutor");

    tutorsCollection = db.collection("booking");
    bookingsCollection = db.collection("bookings");

    console.log("🟢 MongoDB Connected");
  })
  .catch((err) => console.log("Mongo Error:", err));

// ================= JWT VERIFY =================
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
    );

    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;
    next();
  } catch (error) {
    console.log("JWT ERROR:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

// ================= ROUTES =================

// ADD TUTOR
app.post("/tutor", async (req, res) => {
  try {
    const result = await tutorsCollection.insertOne({
      ...req.body,
      totalSlot: Number(req.body.totalSlot),
      hourlyFee: Number(req.body.hourlyFee),
      booked: false,
      createdAt: new Date(),
    });

    res.send({
      success: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to add tutor" });
  }
});

// GET ALL TUTORS
// app.get("/tutor", async (req, res) => {
//   try {
//     const search = req.query.search || "";

//     const query = search
//       ? {
//           $or: [
//             { tutorName: { $regex: search, $options: "i" } },
//             { subject: { $regex: search, $options: "i" } },
//           ],
//         }
//       : {};

//     const result = await tutorsCollection.find(query).toArray();
//     res.send(result);
//   } catch (error) {
//     res.status(500).send({ message: "Failed to load tutors" });
//   }
// });

app.get("/tutor", async (req, res) => {
  try {
    if (!tutorsCollection) {
      return res.status(503).send({
        message: "Database not ready yet",
      });
    }

    const search = req.query.search || "";

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
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Server error" });
  }
});

// FEATURED
app.get("/featured-tutors", async (req, res) => {
  try {
    const result = await tutorsCollection.find({}).limit(4).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed" });
  }
});

// SINGLE TUTOR
app.get("/tutor/:id", async (req, res) => {
  try {
    const result = await tutorsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!result) {
      return res.status(404).send({ message: "Not found" });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Invalid ID" });
  }
});

// BOOK TUTOR
app.patch("/tutor/:id", verifyToken, async (req, res) => {
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

    await tutorsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: { totalSlot: -1 },
        $set: { booked: true },
      },
    );

    res.send({
      success: true,
      message: "Booking successful",
    });
  } catch (error) {
    res.status(500).send({ message: "Booking failed" });
  }
});

// GET BOOKINGS
app.get("/bookings", verifyToken, async (req, res) => {
  try {
    const email = req.user.email;

    const result = await bookingsCollection
      .find({ studentEmail: email })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed bookings" });
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
      { $inc: { totalSlot: 1 } },
    );

    res.send({
      success: true,
      message: "Deleted",
    });
  } catch (error) {
    res.status(500).send({ message: "Error" });
  }
});

// LOCAL SERVER
if (require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
  });
}
// ================= EXPORT =================
module.exports = app;
