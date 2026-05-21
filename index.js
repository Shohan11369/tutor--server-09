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

dotenv.config();
const app = express();
const port = process.env.PORT || 8080;

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});


const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const currentJWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
    const { payload } = await jwtVerify(token, currentJWKS);
    req.user = payload;
    next();
  } catch (error) { return res.status(401).json({ message: "Invalid token" }); }
};

async function run() {
  try {
    const db = client.db("tutor");
    const tutorsCollection = db.collection("booking");


    app.get("/tutors", async (req, res) => {
      const { search } = req.query;
      let query = search ? { $or: [{ tutorName: { $regex: search, $options: "i" } }, { subject: { $regex: search, $options: "i" } }] } : {};
      const result = await tutorsCollection.find(query).toArray();
      res.send(result);
    });

 
    app.get("/featured-tutors", async (req, res) => {
      try {
       
        const result = await tutorsCollection.find({}).limit(4).toArray();
        res.send(result);
      } catch (error) { res.status(500).send({ message: error.message }); }
    });

    console.log("🟢 Database Connected!");
  } catch (error) { console.error("🔴 Database error:", error); }
}

run().catch(console.dir);
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));