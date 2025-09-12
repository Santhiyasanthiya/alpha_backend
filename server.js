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

const client = new MongoClient(URL);

app.use(express.json());
app.use(cors({ origin: "*", credentials: true }));

//------------------------ Nodemailer transporter --------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAILPASSWORD,
  },
});

//------------------------ Server test routes ------------------------
app.get("/", (req, res) => {
  res.send("Alphaingen Server Running...");
});

//------------------------ Register / Signup ------------------------
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    await client.connect();
    const db = client.db("alphaingen");
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
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    await client.close();
  }
});

//------------------------ Login ------------------------
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    await client.connect();
    const db = client.db("alphaingen");
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
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  } finally {
    await client.close();
  }
});


// ****************************************   Ask me question ***************************************************



//------------------------ Questions Collection ------------------------
app.post("/questions", async (req, res) => {
  const { title, content, tags, author, topic } = req.body;
  try {
    await client.connect();
    const db = client.db("alphaingen");
    const questions = db.collection("questions");

    const newQuestion = {
      title,
      content,
      tags: tags || [],
      author: author || "Anonymous",
      topic: topic || "General",
      date: new Date(),
      replies: [],
    };

    const result = await questions.insertOne(newQuestion);

    if (result.acknowledged) {
      res.status(201).json({ message: "Question added successfully", question: newQuestion });
    } else {
      res.status(500).json({ message: "Failed to add question" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    await client.close();
  }
});

// Get all questions
app.get("/questions", async (req, res) => {
  try {
    await client.connect();
    const db = client.db("alphaingen");
    const questions = db.collection("questions");

    const data = await questions.find().sort({ date: -1 }).toArray();
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    await client.close();
  }
});

// Add reply to a question
app.post("/questions/:id/replies", async (req, res) => {
  const { text, author } = req.body;
  const { id } = req.params;

  try {
    await client.connect();
    const db = client.db("alphaingen");
    const questions = db.collection("questions");

    const reply = { text, author: author || "Anonymous", date: new Date() };

    const result = await questions.updateOne(
      { _id: new ObjectId(id) },
      { $push: { replies: reply } }
    );

    if (result.modifiedCount > 0) {
      res.status(200).json({ message: "Reply added successfully" });
    } else {
      res.status(404).json({ message: "Question not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    await client.close();
  }
});

//------------------------ Start server ------------------------
app.listen(PORT, () => {
  console.log("Listening successfully on port", PORT);
});
