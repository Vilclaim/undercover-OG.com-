const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({

type:String,

customer:String,

total:Number,

orderId:String,

productId:{
type:String,
default:""
},

userId:String,

status:String,

itemName:String,

itemImage:String,

qty:Number,

trackingNumber:{
type:String,
default:""
},

time:Date,

read:{
type:Boolean,
default:false
},

message:String

},{
timestamps:true
});

module.exports =
mongoose.model(
"Notification",
notificationSchema
);