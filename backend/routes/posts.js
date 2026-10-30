const express = require('express');
const router = express.Router();
const multer = require('multer');
const Post = require('./../models/post');
const checkAuth = require('../middleware/check-auth');

const MIME_TYPE_MAP = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg'
}

const storage = multer.diskStorage({
  destination: (req,file,cb) => { 
    const isValid = MIME_TYPE_MAP[file.mimetype];
    let error = new Error('Invalid mime type');
    if (isValid){
      error = null;
    }
    cb(error,"backend/images");
   },
   filename: (req,file,cb) => { 
    const name = file.originalname.toLowerCase().split(' ').join('-');
    const ext = MIME_TYPE_MAP[file.mimetype];
    cb(null,name + '-' + Date.now() + '.' + ext);
   }
});

router.post("",checkAuth,multer({storage}).single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image is required!" });
    }
    const url = req.protocol + "://" + req.get("host");
    const post = new Post({
      title: req.body.title,
      content: req.body.content,
      imagePath: url + "/images/" + req.file.filename,
      creator: req.userData.userId
    });
    const createdPost = await post.save();
    res.status(201).json({
      message: 'Post added successfully',
      post: {
        id: createdPost._id,
        title: createdPost.title,
        content: createdPost.content,
        imagePath: createdPost.imagePath
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get("", async (req, res, next) => {
  try {
    const pageSize = +req.query.pagesize;
    const currentPage = +req.query.page;
    const postQuery = Post.find();
    if(pageSize && currentPage){
      postQuery.skip(pageSize * (currentPage - 1)).limit(pageSize);
    }
    const [fetchedPosts, count] = await Promise.all([
      postQuery,
      Post.countDocuments()
    ]);
    res.status(200).json({
      message: "Posts fetched successfully!",
      posts: fetchedPosts,
      maxPosts: count
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (post) {
      res.status(200).json(post);
    } else {
      res.status(404).json({ message: "Post not found!" });
    }
  } catch (err) {
    next(err);
  }
});

router.put("/:id",checkAuth,multer({storage}).single('image'), async (req, res, next) => {
  try {
    let imagePath = req.body.imagePath;
    if(req.file) {
      const url = req.protocol + "://" + req.get("host");
      imagePath = url + "/images/" + req.file.filename;
    }
    const result = await Post.updateOne(
      { _id: req.params.id, creator: req.userData.userId },
      { title: req.body.title, content: req.body.content, imagePath: imagePath }
    );
    // matched = the post exists and belongs to the user (even if nothing changed)
    const matched = result.matchedCount !== undefined ? result.matchedCount : result.n;
    if(matched > 0){
      res.status(200).json({ message: "Post update successful!" });
    }else{
      res.status(401).json({ message: "Not authorized!" });
    }
  } catch (err) {
    next(err);
  }
});

router.delete("/:id",checkAuth, async (req, res, next) => {
  try {
    const result = await Post.deleteOne({
      _id: req.params.id,
      creator: req.userData.userId
    });
    const deleted = result.deletedCount !== undefined ? result.deletedCount : result.n;
    if(deleted > 0){
      res.status(200).json({ message: "Deletion successful!" });
    }else{
      res.status(401).json({ message: "Not authorized!" });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
