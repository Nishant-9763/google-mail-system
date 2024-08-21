const mongoose = require("mongoose");

const sessionSchema = mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      // required: true,
    },
    accessToken: String,
    expiresAt: String,
    emailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
  },
  { timestamps: true }
);

const Session = mongoose.model("session", sessionSchema);

module.exports = Session;
