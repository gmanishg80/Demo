const express = require("express");
const colors = require("colors");
const morgan = require("morgan");
require("./db");
require('dotenv').config();
const stripe = require('stripe')('sk_test_...');



const app = express();
app.use(express.json());
app.use(morgan("dev"));

const PORT = process.env.PORT || 3030;

app.get("/", (req, res) => { console.log(`Server is running at :${PORT} `.bgBlue); });
app.use("/user", require("./routes/subs.route"));
app.listen(PORT, () => { console.log(` Server Connected !!! PORT:${PORT} `.black.bold.underline.bgRed); });