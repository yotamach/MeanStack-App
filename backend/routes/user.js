const express = require('express');
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const User = require('./../models/user');

router.post("/signup", (req, res, next) => {
    bcrypt.hash(req.body.password,10).then((hash) => {
        const user = new User({
            email: req.body.email,
            password: hash
        });
        user.save().then((result) => {
            res.status(201).json({
                message: "User created!",
                result: result
            });
        }).catch((err) => {
            res.status(500).json({ error: err });
        });
    });
});

router.post("/login", (req, res, next) => {
    let fetchedUser;
    User.findOne({ email: req.body.email }).then((user) => {
        if(!user){
            return res.status(401).json({ message: "Auth failed!" });
        }
        fetchedUser = user;
        return bcrypt.compare(req.body.email,user.password);
    }).then((result) => {
        if(!result){
            if(!fetchedUser){
                return res.status(401).json({ message: "Auth failed!" });
            }
        }
        const token = jwt.sign({ email: fetchedUser.email, userId: fetchedUser._id },'g2r0e1e3n_t2o5p8s5_e0n5e2r5g8y30119',{ expiresIn: "1h" });
        res.status(200).json({ 
            token: token, 
            expiresIn: 3600,
            userId: fetchedUser._id 
        });
    }).catch((err) => {
        console.log(err);
        return res.status(401).json({ message: "Auth failed!" });
    });
});

module.exports = router;