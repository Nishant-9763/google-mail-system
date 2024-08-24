const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      // required: true,
    },
    email: {
      type: String,
      unique: true,
    },
    client_id: String,
    client_secret: String,
    refresh_token: String,
    accessToken: String,
    scope: String,
    expiresAt: String,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Client = mongoose.model("Client", clientSchema);

module.exports = Client;
