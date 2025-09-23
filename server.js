import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import Jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 4000;
const URL = process.env.DB;

// ✅ Reuse MongoDB connection (important for Vercel)
let client;
async function getDb() {
  if (!client) {
    client = new MongoClient(URL);
    await client.connect();
    console.log("✅ MongoDB connected");
  }
  return client.db("alphaingen");
}

app.use(express.json());
app.use(cors({ origin: "*", credentials: true }));

// ------------------------ Nodemailer transporter --------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAILPASSWORD,
  },
});

// ------------------------ Server test route ------------------------
app.post("/", (req, res) => {
  res.send("Server Running...");
});
  


app.get("/", (req, res) => {
  res.send("Alphaingen Server Running...");
});

// ------------------------ Register / Signup ------------------------
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const db = await getDb();
    const users = db.collection("signin");

    const finduser = await users.findOne({ email });
    if (finduser) {
      return res.status(400).send({ message: "This user already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const postSignin = await users.insertOne({
      username,
      email,
      password: hashedPassword,
    });

    if (postSignin.acknowledged) {
      const details = {
        from: process.env.EMAIL,
        to: email,
        subject: "Thank You for Registering with [Alphaingen Medical Coding]",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 450px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; box-shadow: 10px 0px 30px 40px rgba(0, 0, 0, 0.2); border-radius: 15px; background-color: #ffd2d2ff;">
            <h2 style="color: orange;">Thank You for Registering!</h2>
            <p>Dear <b>${username}</b>,</p>
            <p>Thank you for registering with us! We're excited to have you here.</p>
            <p>Best regards,<br>[Team Alphaingen Medical Coding]</p>
          </div>
        `,
      };
      await transporter.sendMail(details);

      return res.json({
        statusCode: 200,
        message: "Registered successfully. Check your email for login link.",
      });
    } else {
      return res.status(500).json({ message: "Error during registration" });
    }
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// ------------------------ Login ------------------------
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const db = await getDb();
    const users = db.collection("signin");

    const userFind = await users.findOne({ email });
    if (!userFind) {
      return res.status(400).send({ message: "Invalid Email" });
    }

    const passwordCheck = await bcrypt.compare(password, userFind.password);
    if (!passwordCheck) {
      return res.status(400).send({ message: "Invalid Password" });
    }

    const token = Jwt.sign({ id: userFind._id }, process.env.SECRETKEY);

    res.status(200).send({
      alpha: token,
      message: "Successfully Logged In",
      _id: userFind._id,
      username: userFind.username,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// ------------------------ Ask Question ------------------------
app.post("/questions", async (req, res) => {
  try {
    const { title, content,   topic } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required" });
    }

    const db = await getDb();
    const questions = db.collection("questions");

    const newQuestion = {
      title: title || "Untitled",
      content: content || "",
   
      topic: topic || "General",
      replies: [],
      date: new Date(),
    };

    const result = await questions.insertOne(newQuestion);

    console.log("✅ Question inserted:", result.insertedId);

    res.status(201).json({
      message: "Question posted successfully",
      question: { ...newQuestion, _id: result.insertedId },
    });
  } catch (err) {
    console.error("❌ Post Question error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ------------------------ Get All Questions ------------------------
app.get("/questions", async (req, res) => {
  try {
    const db = await getDb();
    const questions = db.collection("questions");
    const data = await questions.find().sort({ date: -1 }).toArray();
    res.status(200).json(data);
  } catch (err) {
    console.error("Get Questions error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



// ------------------------ Post Reply ------------------------
app.put("/questions/:id/reply", async (req, res) => {
  try {
    const { id } = req.params;
    const { text, author } = req.body;

    const db = await getDb();
    const questions = db.collection("questions");

    const reply = {
      text,
      author: author || "Anonymous",
      date: new Date(),
    };

    const result = await questions.updateOne(
      { _id: new ObjectId(id) },
      { $push: { replies: reply } }
    );

    if (result.modifiedCount === 1) {
      res.status(200).json({ message: "Reply added successfully", reply });
    } else {
      res.status(404).json({ message: "Question not found" });
    }
  } catch (err) {
    console.error("Reply error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



// ------------------------ Guidelines ------------------------
app.post("/guidelines", async (req, res) => {
  try {
    const { email, title, content, image } = req.body;

    if (email !== "chandru@gmail.com") {
      return res.status(403).json({ message: "Not Authorized" });
    }

    const db = await getDb();
    const guidelines = db.collection("guidelines");

    const newGuide = {
      title,
      content,
      image: image || "https://via.placeholder.com/300x200", // base64 string or fallback
      likes: 0,
      likedUsers: [],
      date: new Date(),
    };

    const result = await guidelines.insertOne(newGuide);
    res.status(201).json({
      message: "Guideline created",
      guideline: { ...newGuide, _id: result.insertedId },
    });
  } catch (err) {
    console.error("Guideline post error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get all guidelines
app.get("/guidelines", async (req, res) => {
  try {
    const db = await getDb();
    const guidelines = db.collection("guidelines");
    const data = await guidelines.find().sort({ date: -1 }).toArray();
    res.status(200).json(data);
  } catch (err) {
    console.error("Get Guidelines error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Like a guideline
app.put("/guidelines/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    const db = await getDb();
    const guidelines = db.collection("guidelines");

    const guide = await guidelines.findOne({ _id: new ObjectId(id) });
    if (!guide) return res.status(404).json({ message: "Not Found" });

    if (guide.likedUsers.includes(email)) {
      return res.status(400).json({ message: "Already liked" });
    }

    await guidelines.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { likes: 1 }, $push: { likedUsers: email } }
    );

    res.json({ message: "Liked successfully" });
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});







// ------------------------ Start server ------------------------
app.listen(PORT, () => {
  console.log("Listening successfully on port", PORT);
});
