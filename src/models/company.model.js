const mongoose = require("mongoose");

const companySchema = mongoose.Schema(
  {
    name: String,
    spoc_name:String,
    spoc_phone:String,
  },
  { timestamps: true }
);

const company = mongoose.model("company", companySchema);

module.exports = company;
