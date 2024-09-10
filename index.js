const cors = require("cors");
const express = require("express");
require("dotenv").config();
const mongoose = require("mongoose");
const app = express();
const routes = require("./src/routes/index");

mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.DB_URL, {
    // useNewUrlParser: true,
  })
  .then(() => console.log("MongoDb is connected"))
  .catch((err) => console.log(err));

app.use(cors());
app.use(express.json());
app.post("/login", (req, res) => {
  // Implement your logic for generating and returning the access token
});
app.use("/api", routes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
