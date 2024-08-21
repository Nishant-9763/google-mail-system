const express = require("express");
const router = express.Router();
const gmailController = require("../controllers/gmailController");

router.get("/get-emails", gmailController.getemails);
router.get("/:emailId/read-all-emails", gmailController.readAllMails);
router.get("/:emailId/read-single-emails/:messageId", gmailController.readSingleMails);
router.post("/:emailId/reply-emails", gmailController.sendReply);
router.post("/:emailId/forward-emails", gmailController.forwardMessage);
router.post("/:emailId/delete-emails", gmailController.deleteEmails);
router.post("/:emailId/mark-read-unread-emails", gmailController.markUnreadEmails);
//-------------------------------work in progress ----------------------------------------------------------
router.get("/search/:searchItem", gmailController.searchGmail);
router.get("/read/:searchText", gmailController.readInboxContent);
router.post("/compose", gmailController.composeEmail);
router.get("/labels", gmailController.getLabels);
router.post("/company", gmailController.storeCompany);
router.post("/company-client", gmailController.storeCompanyClients);
router.get("/company-client/:id", gmailController.getCompanyClients);

module.exports = router;
