// const express = require("express");
// const dotenv = require("dotenv");
// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const cors = require("cors");
// const { betterAuth } = require("better-auth");
// const { mongodbAdapter } = require("better-auth/adapters/mongodb");

// dotenv.config();
// const app = express();

// app.use(express.json());
// app.use(
//   cors({
//     origin: "http://localhost:3000",
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   })
// );

// const port = process.env.PORT || 8080;
// const client = new MongoClient(process.env.MONGODB_URI, {
//   serverApi: { version: ServerApiVersion.v1, strict: true },
// });

// let bookingCollection;
// let auth;

// // Better Auth
// const authenticate = async (req, res, next) => {
//   const session = await auth.api.getSession({ headers: req.headers });
//   if (!session) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }
//   req.user = session.user;
//   next();
// };

// async function startServer() {
//   try {

//     await client.connect();
//     console.log("🟢 Database Connected!");

//     const database = client.db("tutor");
//     bookingCollection = database.collection("booking");

//     // Better Auth
//     // server.js এ এই অংশটুকু এভাবে রাখুন
// auth = betterAuth({
//   database: mongodbAdapter(client),
//   emailAndPassword: {
//     enabled: true,
//     autoSignIn: false,
//   },
//   socialProviders: {
//     google: {
//       clientId: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       // allowDangerousEmailAccountLinking: true, // এটি বন্ধ রাখুন যদি না চান যে একই ইমেইল দিয়ে নতুন অ্যাকাউন্ট তৈরি হোক
//     },
//   },
// });

//     // Auth
//     app.use("/api/auth", async (req, res) => {
//       return await auth.handler(req, res);
//     });

//     app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
//   } catch (error) {
//     console.error("🔴 Server Initialization Failed:", error);
//   }
// }

// startServer();

// // TUTORS API
// app.get("/tutors", async (req, res) => {
//   try {
//     const { search, limit } = req.query;
//     let query = { tutorName: { $exists: true } };
//     if (search) {
//       query.$or = [
//         { tutorName: { $regex: search, $options: "i" } },
//         { subject: { $regex: search, $options: "i" } },
//       ];
//     }
//     let cursor = bookingCollection.find(query);
//     if (limit) cursor = cursor.limit(parseInt(limit));
//     const result = await cursor.toArray();
//     res.send(result);
//   } catch (error) { res.status(500).send({ message: error.message }); }
// });

// // Server side: Fetch my tutors
// app.get("/my-tutors/:email", authenticate, async (req, res) => {
//   try {
//     const email = req.params.email;
//     // শুধুমাত্র ওই ইউজারের তৈরি করা টিউটরগুলো আনবে
//     const result = await bookingCollection.find({ userEmail: email }).toArray();
//     res.send(result);
//   } catch (error) {
//     res.status(500).send({ message: error.message });
//   }
// });

// app.get("/tutors/:id", authenticate, async (req, res) => {
//   try {
//     const result = await bookingCollection.findOne({ _id: new ObjectId(req.params.id) });
//     res.send(result || {});
//   } catch (error) { res.status(500).send({ message: error.message }); }
// });

// // BOOKINGS API
// app.post("/bookings", authenticate, async (req, res) => {
//   try {
//     const result = await bookingCollection.insertOne({ ...req.body, bookedAt: new Date() });
//     await bookingCollection.updateOne({ _id: new ObjectId(req.body.tutorId) }, { $inc: { totalSlot: -1 } });
//     res.status(201).send(result);
//   } catch (error) { res.status(500).send({ message: error.message }); }
// });

// app.get("/", (req, res) => res.send("MediQueue System Running..."));

const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

// এনভায়রনমেন্ট ভ্যারিয়েবল কনফিগারেশন
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 8080;
const uri = process.env.MONGODB_URI;

// রিমোট JWKS সেটআপ
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

// MongoDB ক্লায়েন্ট কনফিগারেশন
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// রিকোয়েস্ট লগার মিডলওয়্যার
const logger = (req, res, next) => {
  console.log(`${req.method} | ${req.url}`);
  next();
};

// টোকেন ভেরিফিকেশন মিডলওয়্যার
const verifyToken = async (req, res, next) => {
  const { authorization } = req.headers;
  const token = authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const currentJWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
    );
    const { payload } = await jwtVerify(token, currentJWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("Token validation failed:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

async function run() {
  try {
    // 🎯 ডাটাবেজ এবং কালেকশন নাম রিকোয়ারমেন্ট অনুযায়ী আপডেট করা হলো
    const db = client.db("tutor");
    // ব্যাকএন্ড কোডের এই লাইনটি পরিবর্তন করুন:
const tutorsCollection = db.collection("booking");
    

    // ১. সার্চ এবং সব টিউটর পাওয়ার API (নাম অথবা সাবজেক্ট দিয়ে সার্চ করা যাবে)
    app.get("/tutors", async (req, res) => {
      const { search } = req.query;
      let query = {};

      if (search) {
        query = {
          $or: [
            { tutorName: { $regex: search, $options: "i" } }, // 'name' এর বদলে 'tutorName'
            { subject: { $regex: search, $options: "i" } },
          ],
        };
      }

      const result = await tutorsCollection.find(query).toArray();
      res.send(result);
    });

    // ২. ফিচারড বা অ্যাভেইলেবল টিউটর API (হোম পেজের জন্য লিমিট ৪টি)
    app.get("/featured-tutors", async (req, res) => {
      const result = await tutorsCollection.find().limit(4).toArray();
      // console.log("Backend sending:", result);
      res.send(result);
    });

    // ৩. নির্দিষ্ট টিউটরের ডিটেইলস API (প্রোটেক্টেড)
    app.get("/tutors/:id", logger, verifyToken, async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await tutorsCollection.findOne(query);
      res.send(result);
    });

    // ৪. ইউজারের নিজস্ব বুকিং সেশন দেখার API (প্রোটেক্টেড)
    app.get("/bookings/:userId", verifyToken, async (req, res) => {
      const { userId } = req.params;
      const result = await bookingsCollection
        .find({ userId: userId })
        .toArray();
      res.send(result);
    });

    // ৫. টিউটর সেশন বুক করার API (প্রোটেক্টেড)
    app.patch("/bookings/:tutorId", verifyToken, async (req, res) => {
      const { tutorId } = req.params;
      const bookingData = req.body;

      const tutor = await tutorsCollection.findOne({
        _id: new ObjectId(tutorId),
      });

      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }

      // স্লট খালি আছে কিনা চেক করা
      if (tutor.totalSlot <= 0) {
        return res
          .status(400)
          .json({ message: "No available slots left for this tutor" });
      }

      // 🎯 টিউটর কালেকশনে টোটাল স্লট ১টি কমানো হলো
      await tutorsCollection.updateOne(
        { _id: new ObjectId(tutorId) },
        {
          $inc: { totalSlot: -1 },
        },
      );

      // বুকিং কালেকশনে নতুন ডাটা সেভ করা হলো
      const result = await bookingsCollection.insertOne({
        ...bookingData,
        status: "active",
        bookedAt: new Date(),
      });

      res.send(result);
    });

    // ৬. বুকিং ক্যানসেল করার API (প্রোটেক্টেড - স্লট পুনরায় ১টি বাড়বে)
    app.delete("/bookings/:bookingId", verifyToken, async (req, res) => {
      const { bookingId } = req.params;

      // প্রথমে বুকিংটি খুঁজে বের করা যাতে টিউটর আইডি পাওয়া যায়
      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(bookingId),
      });
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // টিউটরের স্লট পুনরায় ১টি বাড়িয়ে দেওয়া
      if (booking.tutorId) {
        await tutorsCollection.updateOne(
          { _id: new ObjectId(booking.tutorId) },
          { $inc: { totalSlot: 1 } },
        );
      }

      // বুকিং ডাটাবেজ থেকে রিমুভ করা (অথবা চাইলে status: "cancelled" আপডেট করতে পারেন)
      const result = await bookingsCollection.deleteOne({
        _id: new ObjectId(bookingId),
      });
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } catch (error) {
    console.error("Database connection error:", error);
  }
}

// ডাটাবেজ রান করা
run().catch(console.dir);

// রুট টেস্ট রাউট
app.get("/", (req, res) => {
  res.send("Hello World! MediQueue Tutor Server is running.");
});

// সার্ভার লিসেনিং
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
