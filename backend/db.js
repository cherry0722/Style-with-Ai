const mongoose = require("mongoose");

const URI = "mongodb+srv://dbuser:12345@style-with-ai.x1lxnfg.mongodb.net/?retryWrites=true&w=majority&appName=style-with-ai"; 

const connectDB = async () => {
  try {
    await mongoose.connect(URI);
    console.log("✅ Connected to MongoDB!");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

connectDB();

module.exports = mongoose;
