const express = require("express");
const router = express.Router();
const gmailController = require("../controllers/gmailController");

router.get("/search/:searchItem", gmailController.searchGmail);
router.get("/read/:searchText", gmailController.readInboxContent);
router.get("/read-all-mails", gmailController.readAllMails);
router.get("/read-single-mails/:messageId", gmailController.readSingleMails);
router.post("/reply", gmailController.sendReply);
router.post("/compose", gmailController.composeEmail);
router.get("/labels", gmailController.getLabels);
router.post("/company", gmailController.storeCompany);
router.post("/company-client", gmailController.storeCompanyClients);
router.get("/company-client/:id", gmailController.getCompanyClients);
router.get("/get-emails", gmailController.getemails);
router.post("/delete-emails", gmailController.deleteEmails);
router.post("/mark-unread-emails", gmailController.markUnreadEmails);
router.post("/forward-emails", gmailController.forwardMessage);

module.exports = router;
