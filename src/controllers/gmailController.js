const gmailService = require("../services/gmailService");

exports.searchGmail = async (req, res) => {
  const { searchItem } = req.params;
  try {
    const threadId = await gmailService.searchGmail(searchItem);
    res.json({ threadId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.readInboxContent = async (req, res) => {
  const { searchText } = req.params;
  try {
    const decodedStr = await gmailService.readInboxContent(searchText);
    res.json({ decodedStr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.readAllMails = async (req, res) => {
  try {
    const allMails = await gmailService.readAllMails(req,req.query.page, req.query.pageSize);
    // console.log("allMails------------",allMails);  
    // const emails = [];
      // for (const message of allMails) {
      //   const emailContent = await gmailService.readGmailContent(message.id);
      //   emails.push(emailContent);
      // }
      // for (let i = 0; i < allMails.length; i++) {
      //   const message = allMails[i];
      //   const accessToken = accessTokens[i];
      //   const emailContent = await gmailService.readGmailContent(message.id, accessToken); // Pass access token to readGmailContent
      //   emails.push(emailContent);
      // }
      // const newObject = allMails.map(obj => {
      //   const newObj = {};
      //   for (const key in obj) {
      //     if (key !== 'payload') {
      //       newObj[key] = obj[key];
      //     }
      //   }
      //   return newObj;
      // });
      // console.log("allMails--------",allMails[0]);
      // res.json(allMails[0]);
      // return res.json(allMails[0]);

      const newObject = allMails.map(mail => {
        // console.log("mail====================>",mail)
        const newObj = {
          id: mail.id,
          threadId: mail.threadId,
          labelIds: mail.labelIds,
          snippet: mail.snippet,
          headers: {}
        };
      
        // Loop through headers to find and extract specific ones
        mail.payload.headers.forEach(header => {
          switch (header.name) {
            case 'Delivered-To':
              newObj.headers.to = header.value;
              break;
            case 'From':
              newObj.headers.from = header.value;
              break;
            case 'Subject':
              newObj.headers.subject = header.value;
              break;
            case 'Date':
              newObj.headers.date = header.value;
              break;
            // Add more cases for other headers you want to extract
            default:
              break;
          }
        });
      
        return newObj;
      });
      
      res.json(newObject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.readSingleMails = async (req, res) => {
  try {
    console.log("6669d5e0505bda96774e05d9----------1---");
    const singleMails = await gmailService.readGmailContent(req,req.params.messageId);
    
    res.json(singleMails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sendReply = async (req, res) => {
  try {
    const response = await gmailService.sendReply(req);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.composeEmail = async (req, res) => {
  const { message } = req.body;
  try {
    const response = await gmailService.composeEmail(message);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLabels = async (req, res) => {
  try {
    const response = await gmailService.getLabels();
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.storeCompany = async (req, res) => {
  try {
    const response = await gmailService.storeCompany(req);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.storeCompanyClients = async (req, res) => {
  try {
    const response = await gmailService.storeCompanyClients(req);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCompanyClients = async (req, res) => {
  try {
    const response = await gmailService.getCompanyClients(req);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getemails = async (req, res) => {
  try {
    const response = await gmailService.getemails(req);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

