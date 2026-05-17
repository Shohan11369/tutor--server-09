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


const verifyToken = async (req, res, next) => {
  const { authorization } = req.headers;
  const token = authorization?.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized access. Token missing." });
  }

  try {
    
    const secret = process.env.JWT_SECRET || "super_secret_medi_queue_key_2026";
    const decoded = jwt.verify(token, secret);
    req.user = decoded; 

    next();
  } catch (error) {
    console.error("Token validation failed:", error.message);
    return res
      .status(401)
      .json({ message: "Unauthorized access. Invalid token." });
  }
};


app.get("/", (req, res) => {
  res.send("MediQueue Tutor Booking System Server Stack Running Live...");
});

app.listen(port, () => {
  console.log(`🚀 Server executing perfectly on port ${port}`);
});
