const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const config = require('./config');
const postsRoutes = require('./routes/posts');
const userRoutes = require('./routes/user');
const errorHandler = require('./middleware/error-handler');
const app = express();

mongoose.connect(config.mongoUri, { useNewUrlParser: true })
.then(() => {
  console.log('Connected successfully to Database');
}).catch((err) => {
  console.log('Error while connected to Database',err);
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/images",express.static(path.join("backend/images")));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", config.clientOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, PUT, DELETE, OPTIONS"
  );
  next();
});

app.use("/api/posts",postsRoutes);
app.use("/api/user",userRoutes);

app.use(errorHandler);

module.exports = app;
