const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({

userId:{
type:String
},

customerName:{
type:String
},

phone:{
type:String
},

email:{
type:String
},

address:{
type:String
},

emirate:{
type:String,
default:""
},

area:{
type:String,
default:""
},

building:{
type:String,
default:""
},

apartment:{
type:String,
default:""
},

profileImage:{
type:String
},

items:[
{
id:{
type:String,
required:true
},

name:{
type:String,
required:true
},

price:{
type:Number,
required:true
},

qty:{
type:Number,
required:true
},

image:{
type:String,
default:""
},

color:{
type:String,
default:""
}
}
],

total:{
type:Number
},

paymentMethod:{
type:String,
enum:[
"COD",
"Bank Transfer",
"Card Payment"
],
default:"COD"
},

paymentStatus:{
type:String,
enum:[
"Pending",
"Paid",
"Unpaid"
],
default:"Unpaid"
},

deliveryFee:{
type:Number,
default:0
},

trackingNumber:{
type:String,
default:""
},

status:{
type:String,
enum:[
"Pending",
"Processing",
"Shipped",
"Out For Delivery",
"Delivered",
"Cancelled"
],
default:"Pending"
},

isRead:{
type:Boolean,
default:false
},



cancelReason:{
type:String,
default:""
},

cancelledBy:{
type:String,
default:""
},

cancelledAt:{
type:Date
},

createdAt:{
type:Date,
default:Date.now
}

});

module.exports =
mongoose.model("Order", orderSchema);