const mongoose = require('mongoose');

const { Schema } = mongoose;
const userSchema = Schema(
  {
    username: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      trim: true,
      required:true,
    },
    phone: {
      type: String,
    },
    image:{
      type:String
    }
    
  },
);




const User = mongoose.model('User', userSchema);

module.exports = User;