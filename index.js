// const express = require("express");
// require("dotenv").config();
const cors = require("cors");
// const bodyParser = require("body-parser");
// const multer = require("multer");
// const route = require("./src/routes");
// const app = express();
// const mongoose = require("mongoose");

// // Multer configuration
// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // Use cors middleware
// mongoose.set("strictQuery", true);
// mongoose
//   .connect(process.env.DB_URL, {
//     useNewUrlParser: true,
//   })
//   .then(() => console.log("MongoDb is connected"))
//   .catch((err) => console.log(err));

// // Route to handle file uploads
// // app.post("/user", upload.any(), route);

// app.get("/", async (req, res) => {
//     res.send("hii bye");
// });
// app.use("/api", route);

// app.listen(process.env.PORT || 3000, function () {
//   console.log("Express app running on port " + (process.env.PORT || 3000));
// });

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
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
