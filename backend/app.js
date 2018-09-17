const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const postsRoutes = require('./routes/posts');

const app = express();

mongoose.connect('mongodb+srv://yot_yot:8Co0eM4xryUTGBqR@cluster0-hx5db.mongodb.net/MeanStack?retryWrites=true',{ useNewUrlParser: true })
.then((result) => {
  console.log('Connected successfully to Database');  
}).catch((err) => {
  console.log('Error while connected to Database');
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, PUT, DELETE, OPTIONS"
  );
  next();
});

app.use("/api/posts",postsRoutes);

module.exports = app;
