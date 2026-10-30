const express = require('express');
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const User = require('./../models/user');
const config = require('../config');

router.post("/signup", async (req, res, next) => {
    try {
        if (!req.body.email || !req.body.password) {
            return res.status(400).json({ message: "Email and password are required!" });
        }
        const hash = await bcrypt.hash(req.body.password, 10);
        const user = new User({
            email: req.body.email,
            password: hash
        });
        const result = await user.save();
        res.status(201).json({
            message: "User created!",
            result: { id: result._id, email: result.email }
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: "Invalid or already used email!" });
        }
        next(err);
    }
});

router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(401).json({ message: "Auth failed!" });
        }
        const user = await User.findOne({ email: email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Auth failed!" });
        }
        const token = jwt.sign(
            { email: user.email, userId: user._id },
            config.jwtSecret,
            { expiresIn: "1h" }
        );
        res.status(200).json({
            token: token,
            expiresIn: 3600,
            userId: user._id
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
