const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

name:{
type:String,
required:true
},

email:{
type:String,
required:true,
unique:true
},

password:{
type:String,
required:true
},

phone:{
type:String,
default:""
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

address:{
type:String,
default:""
},

profileImage:{
type:String,
default:"/uploads/default-profile.png"
},

role:{
type:String,
enum:["admin","user"],
default:"user"
}

},{
timestamps:true
});

module.exports =
mongoose.model("User", userSchema);



