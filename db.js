const mongoose = require("mongoose");
const colors = require("colors");
require("dotenv").config();
const uri = process.env.MONGO_URL;
mongoose
  .connect(uri)
  .then(() => {
    console.log( `Connected To Mongodb Database ${mongoose.connection.host}!!!`.bgBlack);
  })
  .catch(() => {
    console.log(` Mongodb Database Error ${error} `.bgRed.white);
  });