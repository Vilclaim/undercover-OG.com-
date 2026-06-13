const { Resend } = require("resend");

const resend = new Resend(
process.env.RESEND_API_KEY
);

require("dotenv").config();

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require("express-session");

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/*
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
service: "gmail",
auth: {
user: process.env.EMAIL_USER,
pass: process.env.EMAIL_PASS
}
});
*/



const app = express();






/*
transporter.verify((error, success) => {

if(error){

console.log("EMAIL VERIFY ERROR:");
console.log(error);

}else{

console.log("EMAIL SERVER READY");

}

});

*/


const http = require("http").createServer(app);

app.use(session({
  secret: "undercover_google_secret",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const io = require("socket.io")(http,{
cors:{
origin:"*",
methods:["GET","POST","PUT","DELETE"]
}
});



// ================= MODELS =================

const Product = require("./models/product");
const User = require("./models/user");
const Order = require("./models/order");
const Notification = require("./models/Notification");

const WishlistSchema = new mongoose.Schema({

userId:{
type:mongoose.Schema.Types.ObjectId,
ref:"User",
required:true
},

productId:{
type:mongoose.Schema.Types.ObjectId,
ref:"Product",
required:true
},

createdAt:{
type:Date,
default:Date.now
}

});

const Wishlist =
mongoose.model(
"Wishlist",
WishlistSchema
);

// ================= ROUTES =================

const userRoutes = require("./routes/users");

// ================= CONFIG =================

const PORT = process.env.PORT || 3000;

const JWT_SECRET =
process.env.JWT_SECRET || "trendsettersecret";

const WHATSAPP_NUMBER = "971504238543";

// ================= DATABASE =================

mongoose.set("strictQuery", false);

mongoose.connect(process.env.MONGODB_URI)
.then(() => {
console.log("✅ MongoDB Connected");
})
.catch(err => {
console.log("❌ MongoDB Error:", err);
});

// ================= SOCKET =================

io.on("connection",(socket)=>{

console.log("🟢 Connected:", socket.id);

// ADMIN ROOM
socket.on("joinAdmin", ()=>{

socket.join("admin-room");

console.log("✅ Admin joined");

});

// USER ROOM
socket.on("joinUser",(userId)=>{

socket.join(userId);

console.log("✅ User joined:", userId);

});

});

// ================= MIDDLEWARE =================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
extended:true
}));

app.use("/api/users", userRoutes);



passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {

      let user = await User.findOne({
        email: profile.emails[0].value
      });

      if (!user) {

        user = await User.create({
          name: profile.displayName,
          email: profile.emails[0].value,
          password: "google-login",
          role: "user"
        });

      }

      return done(null, user);

    }
  )
);

// ================= UPLOAD FOLDERS =================

const uploadDir =
path.join(__dirname,"uploads");

const videoDir =
path.join(__dirname,"uploads/videos");

if(!fs.existsSync(uploadDir)){
fs.mkdirSync(uploadDir);
}

if(!fs.existsSync(videoDir)){
fs.mkdirSync(videoDir,{
recursive:true
});
}

app.use("/uploads", express.static(uploadDir));

app.use(express.static(
path.join(__dirname,"public")
));

// ================= MULTER =================

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {

    if(file.mimetype.startsWith("video/")){
      return {
        folder: "undercover-og/videos",
        resource_type: "video"
      };
    }

    return {
      folder: "undercover-og/products",
      resource_type: "image"
    };

  }
});

const upload = multer({

storage,

limits:{
fileSize:100 * 1024 * 1024
}

});

// ================= TOKEN =================

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
jwt.verify(token, JWT_SECRET);

req.user = decoded;

next();

}catch(err){

return res.status(403).json({
message:"Invalid token"
});

}

}

function verifyAdmin(req,res,next){

console.log("===== ADMIN CHECK =====");
console.log(req.user);

if(!req.user){

console.log("NO USER FOUND");

return res.status(403).json({
message:"No user found"
});

}

if(req.user.role !== "admin"){

console.log("ROLE FOUND:", req.user.role);

return res.status(403).json({
message:"Admin access only"
});

}

console.log("ADMIN VERIFIED");

next();

}

// ================= PRODUCTS =================

// GET PRODUCTS
app.get("/api/products", async(req,res)=>{

try{

const products =
await Product.find();

res.json(products);

}catch(err){

console.log(err);

res.status(500).json({
message:"Failed to load products"
});

}

});

// GET SINGLE PRODUCT
app.get("/api/products/:id", async(req,res)=>{

try{

const product =
await Product.findById(req.params.id);

if(!product){

return res.status(404).json({
error:"Not found"
});

}

res.json(product);

}catch(err){

console.log(err);

res.status(500).json({
message:"Failed to load product"
});

}

});

// ADD PRODUCT
app.post(
"/api/products",
verifyToken,
verifyAdmin,
upload.array("galleryFiles",10),
async(req,res)=>{

try{

const body = req.body;

const imageFiles =
req.files?.filter(file =>
!file.mimetype.startsWith("video/")
) || [];

const images =
imageFiles.map(file =>
file.path
);

const image =
images[0] || body.image;

const newProduct = {

name:body.name,

category:body.category,

gender:body.gender,

price:Number(body.price),

oldPrice:Number(body.oldPrice || 0),

stock:Number(body.stock || 0),

badge:body.badge || "Best Seller",

status:
Number(body.stock || 0) <= 0
? "OUT OF STOCK"
: (body.status || "ACTIVE"),

description:body.description || "",

image:image || "",

images:images,

video:
body.video ||
(req.files?.find(file =>
file.mimetype.startsWith("video/")
)
? req.files.find(file =>
file.mimetype.startsWith("video/")
).path
: ""),

colors:body.colors
? body.colors.split(",")
: []

};

const product =
new Product(newProduct);

await product.save();

res.json({
success:true,
product
});

}catch(err){

console.log(err);

res.status(500).json({
success:false
});

}

});




// UPDATE PRODUCT
app.put(
"/api/products/:id",
verifyToken,
verifyAdmin,
upload.array("galleryFiles",10),
async(req,res)=>{

try{

const body = req.body;

const existingProduct =
await Product.findById(req.params.id);

if(!existingProduct){

return res.status(404).json({
error:"Not found"
});

}

const imageFiles =
req.files?.filter(file =>
!file.mimetype.startsWith("video/")
) || [];

const images =
imageFiles.length > 0
? imageFiles.map(file =>
file.path
)
: existingProduct.images || [];

const image =
images[0] ||
body.image ||
existingProduct.image;

await Product.findByIdAndUpdate(
req.params.id,
{

name:body.name,

category:body.category,

gender:body.gender,

price:Number(body.price),

oldPrice:Number(body.oldPrice || 0),

stock:Number(body.stock || 0),

badge:body.badge || "Best Seller",

status:
Number(body.stock || 0) <= 0
? "OUT OF STOCK"
: (body.status || "ACTIVE"),

description:body.description || "",

video:
body.video ||
(req.files?.find(file =>
file.mimetype.startsWith("video/")
)
? req.files.find(file =>
file.mimetype.startsWith("video/")
).path
: existingProduct.video || ""),

colors:body.colors
? body.colors.split(",")
: [],

image,

images

}
);

res.json({
success:true
});

}catch(err){

console.log(err);

res.status(500).json({
success:false
});

}

});

// DELETE PRODUCT
app.delete(
"/api/products/:id",
verifyToken,
verifyAdmin,
async(req,res)=>{

try{

await Product.findByIdAndDelete(
req.params.id
);

res.json({
success:true
});

}catch(err){

console.log(err);

res.status(500).json({
success:false
});

}

});

// ================= VIDEO =================

app.post(
"/api/upload-video",
upload.single("video"),
(req,res)=>{

try{

if(!req.file){

return res.json({
success:false
});

}

res.json({

success:true,

video:{
name:req.file.filename,
url:"/uploads/videos/" + req.file.filename,
size:req.file.size
}

});

}catch(err){

console.log(err);

res.json({
success:false
});

}

});

// ================= ORDERS =================

// GET SINGLE ORDER
app.get(
"/api/orders/:id",
verifyToken,
verifyAdmin,
async(req,res)=>{

try{

const order =
await Order.findById(req.params.id);

if(!order){

return res.status(404).json({
message:"Order not found"
});

}

res.json(order);

}catch(err){

console.log(err);

res.status(500).json({
message:"Failed to load order"
});

}

});

// GET ALL ORDERS
app.get(
"/api/orders",
verifyToken,
verifyAdmin,
async(req,res)=>{

try{

const orders =
await Order.find()
.sort({createdAt:-1});

res.json(orders);

}catch(err){

console.log(err);

res.status(500).json({
message:"Failed to fetch orders"
});

}

});

// CREATE ORDER
app.post(
"/api/orders",
verifyToken,
async(req,res)=>{

try{

const {
items,
paymentMethod
} = req.body;

const user = await User.findById(req.user.id);

if(!user){

return res.status(404).json({
error:"User not found"
});

}

const customerName = user.name;
const phone = user.phone;
const email = user.email;
const address = user.address;

console.log("========== ORDER EMAIL ==========");
console.log("USER NAME:", customerName);
console.log("USER EMAIL:", email);
console.log("=================================");

const profileImage = user.profileImage;

const emirate = user.emirate;
const area = user.area;
const building = user.building;
const apartment = user.apartment;

let total = 0;

if(!items || items.length === 0){

return res.status(400).json({
error:"No items found"
});

}

for(const item of items){

const product =
await Product.findById(item.id);

if(product){

total +=
product.price * item.qty;

product.sold =
(product.sold || 0) + item.qty;

if(product.stock < item.qty){

return res.status(400).json({
error:`${product.name} out of stock`
});

}

product.stock -= item.qty;

if(product.stock <= 0){

product.stock = 0;

product.status = "OUT OF STOCK";

}

await product.save();

}

}

const order = new Order({

userId:req.user.id,

customerName,
phone,
email,
address,

emirate,
area,
building,
apartment,

profileImage,

items,

total,

paymentMethod,

paymentStatus:
paymentMethod === "COD"
? "Unpaid"
: "Pending",

status:"Pending"

});

await order.save();


console.log("=================================");
console.log("ORDER SAVED");
console.log("EMAIL:", email);
console.log("CUSTOMER:", customerName);
console.log("=================================");

await resend.emails.send({

from:"onboarding@resend.dev",

to:email,

subject:"Order Confirmation - UNDERCOVER-OG",

html:`

<h2>Thank you for your order!</h2>

<p>Hello ${customerName},</p>

<p>Your order has been placed successfully.</p>

<p><strong>Order ID:</strong> ${order._id}</p>

<p><strong>Total:</strong> AED ${total}</p>

<p><strong>Status:</strong> Pending</p>

`

});

console.log("ORDER EMAIL SENT");

const customerNotification =
await Notification.create({

type:"orderPlaced",

customer:customerName,

total:total,

orderId:order._id,

userId:req.user.id,

productId:
items?.[0]?.id,

status:"Pending",

itemName:
items?.[0]?.name || "Product",

itemImage:
items?.[0]?.image ||
"/uploads/default-product.png",

qty:
items?.[0]?.qty || 1,

time:new Date(),

read:false,

message:"✅ Your order was placed successfully."

});

const notificationData = {

type:"newOrder",

customer:customerName,

total:total,

orderId:order._id,

productId:
items?.[0]?.id,

userId:null,

status:"Pending",

itemName:
items?.[0]?.name || "Product",

itemImage:
items?.[0]?.image ||
items?.[0]?.images?.[0] ||
"/uploads/default-product.png",

qty:
items?.[0]?.qty || 1,

time:new Date(),

read:false,

message:`New order from ${customerName}`

};

const newNotification =
await Notification.create(notificationData);

io.to("admin-room").emit(
"newOrder",
newNotification
);

res.json({

success:true,

orderId:order._id,

whatsapp:WHATSAPP_NUMBER

});

}catch(err){

console.log(err);

res.status(500).json({
success:false
});

}

});

// UPDATE ORDER STATUS
app.put(
"/api/orders/:id",
verifyToken,
verifyAdmin,
async(req,res)=>{

try{

const {
status,
trackingNumber
} = req.body;

const updateData = {
status
};

if(trackingNumber){
updateData.trackingNumber = trackingNumber;
}

const updatedOrder =
await Order.findByIdAndUpdate(
req.params.id,
updateData,
{ new:true }
);

const userNotification = {

type:"statusUpdate",

customer:updatedOrder.customerName,

total:updatedOrder.total,

orderId:updatedOrder._id,

productId:
updatedOrder.items?.[0]?.id,

userId:updatedOrder.userId,

status:status,

itemName:
updatedOrder.items?.[0]?.name || "Product",

itemImage:
updatedOrder.items?.[0]?.image ||
updatedOrder.items?.[0]?.images?.[0] ||
"/uploads/default-product.png",

qty:
updatedOrder.items?.[0]?.qty || 1,

trackingNumber: trackingNumber,

time:new Date(),

read:false,

message:
status === "Shipped"
? `Your order has been shipped. Tracking Number: ${trackingNumber}`
: `Your order is now ${status}`

};

console.log("SAVING NOTIFICATION:");
console.log(userNotification);

const savedNotification =
await Notification.create(
userNotification
);

io.to(String(updatedOrder.userId)).emit(
"orderStatusUpdated",
savedNotification
);

io.to("admin-room").emit(
"orderStatusUpdated",
savedNotification
);

const user =
await User.findById(updatedOrder.userId);

console.log("========== STATUS EMAIL ==========");
console.log("USER:", user);
console.log("EMAIL:", user?.email);
console.log("==================================");

if(user?.email){

await resend.emails.send({

from:"onboarding@resend.dev",

to:user.email,

subject:`Order Update - ${status}`,

html:`

<h2>UNDERCOVER-OG</h2>

<p>Hello ${user.name},</p>

<p>Your order status has been updated.</p>

<p><strong>Status:</strong> ${status}</p>

`

});

console.log("STATUS EMAIL SENT");

}

console.log("NOTIFICATION SAVED:");
console.log(savedNotification);







res.json({
success:true
});

}catch(err){

console.log(err);

res.status(500).json({
success:false
});

}

});

// UPDATE PAYMENT STATUS
app.put(
"/api/orders/payment/:id",
verifyToken,
verifyAdmin,
async(req,res)=>{

try{

const { paymentStatus } = req.body;

console.log("PAYMENT STATUS:", paymentStatus);

await Order.findByIdAndUpdate(
req.params.id,
{
paymentStatus
}
);

res.json({
success:true
});

}catch(err){

console.log(err);

res.status(500).json({
success:false
});

}

});

// DELETE ORDER
app.put(
"/api/orders/cancel/:id",
verifyToken,
async(req,res)=>{

try{

const order =
await Order.findById(req.params.id);

if(!order){

return res.status(404).json({
success:false,
message:"Order not found"
});

}

if(
order.status !== "Pending" &&
order.status !== "Processing"
){

return res.status(400).json({
success:false,
message:"Order cannot be cancelled"
});

}

order.status = "Cancelled";

await order.save();

res.json({
success:true
});

}catch(err){

console.log(err);

res.status(500).json({
success:false,
message:"Server Error"
});

}

});

app.delete(
"/api/orders/:id",
verifyToken,
verifyAdmin,
async(req,res)=>{

try{

await Order.findByIdAndDelete(
req.params.id
);

res.json({
success:true
});

}catch(err){

console.log(err);

res.status(500).json({
success:false
});

}

});


// ================= INVOICE =================

app.get(
"/invoice/:id",
verifyToken,
verifyAdmin,
async(req,res)=>{

try{

const order =
await Order.findById(req.params.id);

if(!order){

return res.send("Order not found");

}

res.send(`

<html>

<head>

<title>Invoice</title>

<style>

body{
font-family:Arial,sans-serif;
padding:2px;
font-size:10px;
margin:0;
line-height:1.1;
zoom:80%;
}

table{
width:100%;
border-collapse:collapse;
margin-top:10px;
}

th,td{
border:1px solid #ddd;
padding:5px;
font-size:12px;
}

th{
background:#f5f5f5;
}

h1{
font-size:18px;
margin:0;
}

h2{
font-size:14px;
margin:3px 0;
}

p{
margin:1px 0;
}

@media print{

body{
padding:10px;
font-size:11px;
}

table{
font-size:11px;
}

th,td{
padding:4px;
}

h1{
font-size:20px !important;
}

h2{
font-size:16px !important;
}

}

@page{
size:A4;
margin:2mm;
}

body{
zoom:90%;
}

table{
font-size:11px;
}

th,td{
padding:4px;
}

</style>

</head>

<body>





<hr>

<h2>Invoice</h2>

<style>
table{
page-break-inside:avoid;
}

tr{
page-break-inside:avoid;
}

div{
page-break-inside:avoid;
}
</style>

<div style="
background:#f8fafc;
padding:4px;
border-radius:8px;
font-size:10px;
line-height:1.1;
margin-bottom:8px;
">

<b>Invoice No:</b>
INV-${order._id.slice(-5)}

&nbsp;&nbsp;|&nbsp;&nbsp;

<b>Date:</b>
${new Date().toLocaleDateString()}

<br>

<b>Customer:</b>
${order.customerName}

&nbsp;&nbsp;|&nbsp;&nbsp;

<b>Phone:</b>
${order.phone}

<br>

<b>Status:</b>
${order.status}

&nbsp;&nbsp;|&nbsp;&nbsp;

<b>Payment:</b>
${order.paymentStatus || "Unpaid"}

<br>

<b>Tracking:</b>
${order.trackingNumber || "N/A"}

<br>

<b>Address:</b>
${order.address || "N/A"}

</div>

<table>

<tr>

<th>Product</th>
<th>Qty</th>
<th>Price</th>

</tr>

${order.items.map(item=>`

<tr>

<td>${item.name}</td>

<td>${item.qty}</td>

<td>AED ${item.price}</td>

</tr>

`).join("")}

</table>

<div style="
margin-top:10px;
padding:10px;
background:#f8fafc;
border-radius:12px;
text-align:right;
">

<h2 style="
color:#00c896;
font-size:18px;
">
TOTAL: AED ${order.total}
</h2>

</div>

<hr style="margin-top:15px;">

<div style="
text-align:center;
font-size:13px;
color:#666;
">

Thank you for shopping with UNDERCOVER-OG ❤️

<br><br>

TELFORD INTERNATIONAL TRADING - FZCO

<br>

Trade License No: 76993

<br>

Dubai Silicon Oasis, Dubai UAE

<br><br>



</div>

</body>

</html>

`);

}catch(err){

console.log(err);

res.send("Invoice Error");

}

}
);

// ================= USER ORDERS =================

app.get(
"/api/my-orders/:userId",
async(req,res)=>{

try{

const token =
req.headers.authorization?.split(" ")[1];

if(!token){

return res.status(401).json({
message:"No token"
});

}

const decoded =
jwt.verify(token, JWT_SECRET);

if(decoded.id !== req.params.userId){

return res.status(403).json({
message:"Unauthorized"
});

}

const orders =
await Order.find({
userId:String(req.params.userId)
}).sort({createdAt:-1});

res.json(orders);

}catch(err){

console.log(err);

res.status(500).json({
message:"Server Error"
});

}

});

// ================= NOTIFICATIONS =================

// ONLY ONE NOTIFICATION ROUTE
app.get(
"/api/notifications",
verifyToken,
async(req,res)=>{

try{

const decodedUser = req.user.id;

console.log("CURRENT USER ID:");
console.log(decodedUser);

const allUserNotifications =
await Notification.find({
userId:decodedUser
});

console.log(
"FOUND USER NOTIFICATIONS:",
allUserNotifications.length
);

const user =
await User.findById(decodedUser);

let notifications;

if(user?.role === "admin"){

notifications =
await Notification.find({
type:"newOrder"
})
.sort({createdAt:-1});

}else{

notifications =
await Notification.find({
userId:decodedUser
})
.sort({createdAt:-1});

}

res.json(notifications);

}catch(err){

console.log(err);

res.status(500).json({
message:"Failed to load notifications"
});

}

});

// MARK AS READ
app.put(
"/api/notifications/read/:id",
verifyToken,
async(req,res)=>{

try{

console.log("=================================");
console.log("READ ROUTE HIT");
console.log("NOTIFICATION ID:", req.params.id);

const updatedNotification =
await Notification.findByIdAndUpdate(
req.params.id,
{
read:true
},
{
new:true
}
);

console.log("UPDATED NOTIFICATION:");
console.log(updatedNotification);

res.json({
success:true,
notification:updatedNotification
});

}catch(err){

console.log(err);

res.status(500).json({
success:false
});

}

});


// MARK ALL NOTIFICATIONS READ
app.put(
"/api/notifications/mark-all-read",
verifyToken,
async(req,res)=>{

try{

const user = await User.findById(req.user.id);

if(user?.role === "admin"){

await Notification.updateMany(
{ type:"newOrder", read:false },
{ $set:{ read:true } }
);

}else{

await Notification.updateMany(
{ userId:req.user.id, read:false },
{ $set:{ read:true } }
);

}

res.json({ success:true });

}catch(err){

console.log(err);
res.status(500).json({ success:false });

}

});

// CLEAR ALL NOTIFICATIONS

app.delete(
"/api/notifications/clear-notifications",
verifyToken,
async(req,res)=>{

try{

const user =
await User.findById(req.user.id);

if(user?.role === "admin"){

await Notification.deleteMany({
type:"newOrder"
});

}else{

await Notification.deleteMany({
userId:req.user.id
});

}

res.json({
success:true
});

}catch(err){

console.log(err);

res.status(500).json({
success:false
});

}

});



// ================= REGISTER =================

app.post("/api/register", async(req,res)=>{

try{

const {
name,
email,
password,
phone
} = req.body;

const existingUser =
await User.findOne({email});

if(existingUser){

return res.status(400).json({
message:"Email already exists"
});

}

const hashedPassword =
await bcrypt.hash(password,10);

const user = new User({

name,
email,
phone,

password:hashedPassword

});

await user.save();

res.json({
message:"User registered successfully"
});

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

});

// ================= LOGIN =================

app.post("/api/login", async(req,res)=>{

try{

const {
email,
password
} = req.body;

const user =
await User.findOne({email});

if(!user){

return res.status(400).json({
message:"User not found"
});

}

const isMatch =
await bcrypt.compare(
password,
user.password
);

if(!isMatch){

return res.status(400).json({
message:"Invalid password"
});

}

const token = jwt.sign(

{
id:user._id,
email:user.email,
role:user.role
},

JWT_SECRET,

{
expiresIn:"7d"
}

);

res.json({

message:"Login successful",

token,

user:{
id:user._id,
name:user.name,
email:user.email,
phone:user.phone,
address:user.address,
profileImage:user.profileImage,
role:user.role
}

});

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

});

// ================= PROFILE =================

app.get(
"/api/user-profile",
async(req,res)=>{

try{

const token =
req.headers.authorization?.split(" ")[1];

if(!token){

return res.status(401).json({
message:"No token"
});

}

const decoded =
jwt.verify(token, JWT_SECRET);

const user =
await User.findById(decoded.id);

if(!user){

return res.status(404).json({
message:"User not found"
});

}

res.json(user);

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

});

// UPDATE PROFILE
app.put(
"/api/user-profile",
upload.single("profileImage"),
async(req,res)=>{

try{

const token =
req.headers.authorization?.split(" ")[1];

const decoded =
jwt.verify(token, JWT_SECRET);

const user =
await User.findById(decoded.id);

if(!user){

return res.status(404).json({
message:"User not found"
});

}

user.name =
req.body.name || user.name;

user.phone =
req.body.phone || user.phone;

user.emirate =
req.body.emirate || user.emirate;

user.area =
req.body.area || user.area;

user.building =
req.body.building || user.building;

user.apartment =
req.body.apartment || user.apartment;

user.address =
req.body.address || user.address;

if(req.file){

  console.log("REQ BODY:", req.body);

console.log("EMIRATE =", req.body.emirate);
console.log("AREA =", req.body.area);
console.log("BUILDING =", req.body.building);
console.log("APARTMENT =", req.body.apartment);

user.profileImage = req.file.path;

}

await user.save();

res.json({
success:true,
user
});

}catch(err){

console.log(err);

res.status(500).json({
message:"Update failed"
});

}

});

// ================= STATS =================

app.get(
"/api/stats",
verifyToken,
verifyAdmin,
async(req,res)=>{

try{

const totalProducts =
await Product.countDocuments();

const totalOrders =
await Order.countDocuments();

const totalUsers =
await User.countDocuments();

const pendingOrders =
await Order.countDocuments({
status:"Pending"
});

const outOfStock =
await Product.countDocuments({
status:"OUT OF STOCK"
});

const orders =
await Order.find();

const totalSales =
orders.reduce((sum,order)=>
sum + order.total,0);

res.json({

totalProducts,
totalOrders,
totalUsers,
pendingOrders,
outOfStock,
totalSales

});

}catch(err){

console.log(err);

res.status(500).json({
message:"Failed to fetch stats"
});

}

});


// ================= WISHLIST =================

app.post(
"/api/wishlist",
verifyToken,
async(req,res)=>{

try{

const { productId } = req.body;

const exists =
await Wishlist.findOne({

userId:req.user.id,
productId

});

if(exists){

return res.json({
success:false,
message:"Already in wishlist"
});

}

await Wishlist.create({

userId:req.user.id,
productId

});

res.json({
success:true
});

}catch(err){

console.log(err);

res.status(500).json({
success:false
});

}

});

app.get(
"/api/wishlist",
verifyToken,
async(req,res)=>{

try{

const wishlist =
await Wishlist.find({
userId:req.user.id
})
.populate("productId");

res.json(wishlist);

}catch(err){

console.log(err);

res.status(500).json([]);

}

});

// ================= REVIEWS =================

app.post(
"/api/reviews/:productId",
verifyToken,
async(req,res)=>{

try{

const {
rating,
title,
comment
} = req.body;

const product =
await Product.findById(
req.params.productId
);

if(!product){

return res.status(404).json({
success:false,
message:"Product not found"
});

}

const user =
await User.findById(req.user.id);

const alreadyReviewed =
product.reviews.find(
r => String(r.userId) === String(req.user.id)
);

if(alreadyReviewed){

return res.status(400).json({
success:false,
message:"You already reviewed this product"
});

}

product.reviews.push({
userId:req.user.id,
userName:user.name,
userImage:user.profileImage ||
"/uploads/default-profile.png",
rating,
title,
comment,
createdAt:new Date()
});

product.reviewCount =
product.reviews.length;

product.averageRating =

product.reviews.reduce(
(sum,r)=>
sum + r.rating,
0
)

/

product.reviewCount;

await product.save();

res.json({
success:true
});

}catch(err){

console.log(err);

res.status(500).json({
success:false
});

}

});


app.get(
"/auth/google",
passport.authenticate(
"google",
{
scope:["profile","email"]
}
)
);

app.get(
"/auth/google/callback",
passport.authenticate(
"google",
{
failureRedirect:"/"
}
),
(req,res)=>{

const token = jwt.sign(
{
id:req.user._id,
email:req.user.email,
role:req.user.role
},
JWT_SECRET,
{
expiresIn:"7d"
}
);

res.redirect(
`/?token=${token}`
);

}
);


app.get("/test-email", async(req,res)=>{

try{

const data = await resend.emails.send({

from:"onboarding@resend.dev",

to:"calimvilandrew631@gmail.com",

subject:"UNDERCOVER-OG TEST",

html:"<h2>Resend is working!</h2>"

});

console.log(data);

res.send("EMAIL SENT");

}catch(err){

console.log(err);

res.send("EMAIL FAILED");

}

});






// ================= FRONTEND =================

app.get("*",(_req,res)=>{

res.sendFile(
path.join(
__dirname,
"public",
"index.html"
)
);

});

// ================= SERVER =================

http.listen(PORT,()=>{

console.log(
`🚀 Server running on http://localhost:${PORT}`
);

});

// ================= ERROR HANDLER =================

process.on("uncaughtException",err=>{

console.log(
"UNCAUGHT ERROR:",
err
);

});

process.on("unhandledRejection",err=>{

console.log(
"UNHANDLED REJECTION:",
err
);

});


