const jwt = require('jsonwebtoken');

module.exports = (req,res,next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];    
        const decodedToken = jwt.verify(token,"g2r0e1e3n_t2o5p8s5_e0n5e2r5g8y30119"); 
        req.userData = { email: decodedToken.email, userId: decodedToken.userId };
        next();   
    } catch (error) {
        res.status(401).json({message: "Auth failed!"});
    }
};