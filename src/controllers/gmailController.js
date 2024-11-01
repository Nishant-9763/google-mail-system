const gmailService = require("../services/gmailService");

exports.searchGmail = async (req, res) => {
  const { searchItem } = req.params;
  try {
    const threadId = await gmailService.searchGmail(searchItem);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.readInboxContent = async (req, res) => {
  const { searchText } = req.params;
  try {
    const decodedStr = await gmailService.readInboxContent(searchText);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.readAllMails = async (req, res) => {
  try {
    const allMails = await gmailService.readAllMails(
      req,
      req.query.page,
      req.query.pageSize
    );

    res.json({ data: allMails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.readSingleMails = async (req, res) => {
  try {
    const singleMails = await gmailService.readGmailContent(
      req,
      req.params.messageId
    );

    res.json({ data: singleMails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sendReply = async (req, res) => {
  try {
    const response = await gmailService.sendReply(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.composeEmail = async (req, res) => {
  try {
    const response = await gmailService.composeEmail(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.saveDraft = async (req, res) => {
  try {
    const response = await gmailService.saveDraft(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateDraft = async (req, res) => {
  try {
    const response = await gmailService.updateDraft(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sendDraft = async (req, res) => {
  try {
    const response = await gmailService.sendDraft(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.listDrafts = async (req, res) => {
  try {
    const response = await gmailService.listDrafts(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSingleDraft = async (req, res) => {
  try {
    const response = await gmailService.getSingleDraft(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLabels = async (req, res) => {
  try {
    const response = await gmailService.getLabels();
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.storeCompany = async (req, res) => {
  try {
    const response = await gmailService.storeCompany(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.storeCompanyClients = async (req, res) => {
  try {
    const response = await gmailService.storeCompanyClients(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCompanyClients = async (req, res) => {
  try {
    const response = await gmailService.getCompanyClients(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getemails = async (req, res) => {
  try {
    const response = await gmailService.getemails(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteEmails = async (req, res) => {
  try {
    const response = await gmailService.deleteEmails(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markUnreadEmails = async (req, res) => {
  try {
    const response = await gmailService.markUnreadEmails(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.forwardMessage = async (req, res) => {
  try {
    const response = await gmailService.forwardMessage(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateEmails = async (req, res) => {
  try {
    const response = await gmailService.updateEmails(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteLocalEmail = async (req, res) => {
  try {
    const response = await gmailService.deleteLocalEmail(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.genrateToken = async (req, res) => {
  try {
    const response = await gmailService.genrateToken(req);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.auth = async (req, res) => {
  try {
    const response = await gmailService.auth(req, res);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.oauth2callback = async (req, res) => {
  try {
    const response = await gmailService.oauth2callback(req, res);
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAttachment = async (req, res) => {
  try {
    const response = await gmailService.getAttachment(
      req,
      req.params.messageId,
      req.params.attachmentId
    );
    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProxyImage = async (req, res) => {
  try {
    const response = await gmailService.getProxyImage(req, res);

    res.json({ data: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
