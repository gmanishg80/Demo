const express = require("router");
const router = express.Router();
const subscription =require("../controllers/subscription.controller");


router.get("/subscription", subscription );


module.exports =router;