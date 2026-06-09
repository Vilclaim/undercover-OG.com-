const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({

name:String,
category:String,

gender:{
type:String,
default:""
},

price:Number,
oldPrice:Number,
stock:Number,

sold:{
type:Number,
default:0
},

badge:String,
status:String,
description:String,

image:String,

images:[String],

video:String,

colors:[String],

reviews:[
{
userId:String,
userName:String,

userImage:{
type:String,
default:"/uploads/default-profile.png"
},



rating:Number,
comment:String,
images:[String],
createdAt:{
type:Date,
default:Date.now
}
}
],

averageRating:{
type:Number,
default:0
},

reviewCount:{
type:Number,
default:0
}

});



module.exports =
mongoose.model("Product", productSchema);