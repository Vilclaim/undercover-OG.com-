const express = require("express");
const router = express.Router();

const User = require("../models/user");
const jwt = require("jsonwebtoken");

const JWT_SECRET =
process.env.JWT_SECRET || "trendsettersecret";

function verifyToken(req,res,next){

const token =
req.headers.authorization?.split(" ")[1];

if(!token){
return res.status(401).json({
message:"No token"
});
}

try{

const decoded =
jwt.verify(token,JWT_SECRET);

req.user = decoded;

next();

}catch{

return res.status(403).json({
message:"Invalid token"
});
}

}

function verifyAdmin(req,res,next){

if(req.user.role !== "admin"){

return res.status(403).json({
message:"Admin access only"
});

}

next();

}

router.get(
"/",
verifyToken,
verifyAdmin,
async(req,res)=>{

try{

const users =
await User.find()
.sort({createdAt:-1});

res.json(users);

}catch(err){

console.log(err);

res.status(500).json({
message:"Server Error"
});

}

});

module.exports = router;