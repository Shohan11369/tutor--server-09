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



//GET ALL TUTORS (With Search & Date Filter)

app.get("/tutors", async (req, res) => {
  try {
    const { search, startDate, endDate, limit } = req.query;

    let query = {};


    if (search) {
      query.tutorName = {
        $regex: search,
        $options: "i",
      };
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

    let cursor = tutorsCollection.find(query);


    if (limit) {
      cursor = cursor.limit(parseInt(limit));
    }

    const result = await cursor.toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.send("MediQueue Tutor Booking System Server Stack Running Live...");
});

app.listen(port, () => {
  console.log(`🚀 Server executing perfectly on port ${port}`);
});
