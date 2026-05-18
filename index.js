const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 8080;
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// GET ALL TUTORS (With Multi-field Search & Date Filter)
app.get("/tutors", async (req, res) => {
  try {
    const { search, startDate, endDate, limit } = req.query;

    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { tutorName: { $regex: search, $options: "i" } },
        { language: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      query.sessionStartDate = {};

      if (startDate) {
        query.sessionStartDate.$gte = startDate;
      }

      if (endDate) {
        query.sessionStartDate.$lte = endDate;
      }
    }
    const database = client.db("tutor");
    const tutorsCollection = database.collection("booking");
    let cursor = tutorsCollection.find(query);

    if (limit) {
      cursor = cursor.limit(parseInt(limit));
    }

    const result = await cursor.toArray();

    if (!result || result.length === 0) {
      return res.send([]);
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});


// GET  FETCH SINGLE TUTOR BY ID

app.get("/tutors/:id", async (req, res) => {
  try {
    if (!tutorsCollection) {
      return res.status(500).json({ message: "Database collections are not ready." });
    }

    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Tutor ID format" });
    }

    const query = { _id: new ObjectId(id) };
    const result = await tutorsCollection.findOne(query);

    if (!result) {
      return res.status(404).json({ message: "Tutor session not found." });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("MediQueue Tutor Booking System Server Stack Running Live...");
});

app.listen(port, () => {
  console.log(`🚀 Server executing perfectly on port ${port}`);
});
