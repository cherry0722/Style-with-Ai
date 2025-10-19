const express = require("express");
const cors = require("cors");
require("./db"); // MongoDB connection
const userRoutes = require("./routes/user");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
 