const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");

router.post("/get-or-create", chatController.getOrCreateChat);
router.get("/messages/:chatId", chatController.getMessages);
router.post("/send", chatController.sendMessage);

module.exports = router;
