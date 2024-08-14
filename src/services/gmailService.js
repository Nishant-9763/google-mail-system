const axios = require("axios");
const qs = require("qs");
// const nodemailer = require("nodemailer");
const ClientModel = require("../models/client.model");
const CompanyModel = require("../models/company.model");

// getAccessToken = async () => {
//  let  companyId= "6669d5e0505bda96774e05d9"
//   const findClientCred = await getCompanyClients(companyId)
//   findClientCred.map(async (e)=>{
//     const data = qs.stringify({
//       client_id: e.client_id,
//       client_secret: e.client_secret,
//       refresh_token: e.refresh_token,
//       grant_type: "refresh_token",
//     });

//     const config = {
//       method: "post",
//       url: "https://oauth2.googleapis.com/token",
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded",
//       },
//       data: data,
//     };

//     try {
//       const response = await axios(config);
//       accessToken = response.data.access_token;
//       return accessToken;
//     } catch (error) {
//       console.error("Error getting access token: ", error);
//       throw error;
//     }
//   })
// };
const getAccessToken = async (req) => {
  let companyId;
  if (req.query && req.query.email_id) {
    const { email_id } = req.query;
    companyId = email_id;
  } else {
    companyId = "6669d5e0505bda96774e05d9";
  }
  console.log("req.query=======1==========",companyId);
  try {
    const findClientCred = await getCompanyClients(companyId);
    console.log("findClientCred------------", findClientCred);
    const accessTokenPromises = findClientCred.map(async (client) => {
      const data = qs.stringify({
        client_id: client.client_id,
        client_secret: client.client_secret,
        refresh_token: client.refresh_token,
        grant_type: "refresh_token",
      });

      const config = {
        method: "post",
        url: "https://oauth2.googleapis.com/token",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: data,
      };

      try {
        const response = await axios(config);
        return response.data.access_token;
      } catch (error) {
        console.error(
          `Error getting access token for client ${client.client_id}:`,
          error.message
        );
        // Continue processing other tokens even if one fails
        return null;
      }
    });

    // Wait for all access tokens to be retrieved
    const accessTokens = await Promise.all(accessTokenPromises);
    console.log("accessTokens-------------", accessTokens);
    // Filter out any null values that resulted from failed requests
    return accessTokens.filter((token) => token !== null);
  } catch (error) {
    console.error("Error fetching client credentials:", error.message);
    throw error;
  }
};

const searchGmail = async (searchItem) => {
  const accessToken = await getAccessToken();
  console.log("accessToken-----------", accessToken);
  const config = {
    method: "get",
    url: `https://www.googleapis.com/gmail/v1/users/me/messages?q=${searchItem}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  try {
    const response = await axios(config);
    console.log("response-----------", response);
    const threadId = response.data.messages[0].id;
    return threadId;
  } catch (error) {
    console.error("Error searching Gmail: ", error.message);
    throw error;
  }
};

const readGmailContent = async (req, messageId, accessToken) => {
  console.log("2----------------------");
  if (!accessToken) {
    accessToken = await getAccessToken(req);
  }
  console.log("accessToken==========", accessToken);

  const config = {
    method: "get",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error reading Gmail content: ", error.message);
    throw error;
  }

  // try {
  //   // const accessTokens = await getAccessToken(); // Get access tokens
  //   const emailContents = []; // Array to store email contents

  //   for (const accessToken of accessTokens) {
  //     const config = {
  //       method: "get",
  //       url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
  //       headers: {
  //         Authorization: `Bearer ${accessToken}`, // Include access token in request headers
  //       },
  //     };
  //     const response = await axios(config); // Make request using axios
  //     emailContents.push(response.data); // Add email content to array
  //   }

  //   return emailContents; // Return array of email contents
  // } catch (error) {
  //   console.error("Error reading Gmail content:", error);
  //   throw error; // Rethrow error to propagate it up the call stack
  // }
};

const readInboxContent = async (searchText) => {
  const threadId = await this.searchGmail(searchText);
  const message = await this.readGmailContent(threadId);
  const encodedMessage = message.payload.parts[0].body.data;
  const decodedStr = Buffer.from(encodedMessage, "base64").toString("ascii");
  return decodedStr;
};

const readAllMails = async (req, page = 1, pageSize = 10) => {
  let allMessages = [];
  let nextPageToken = null;
  let accessTokens;

  try {
    accessTokens = await getAccessToken(req);
  } catch (error) {
    console.error("Failed to get access tokens:", error);
    throw error;
  }

  // do {
  //   const messages = await listMessages(nextPageToken, pageSize);
  //   allMessages = allMessages.concat(messages.messages);
  //   nextPageToken = messages.nextPageToken;
  //   page--;
  // } while (nextPageToken && page > 0);
  for (const token of accessTokens) {
    let pageToken = null;
    let currentPage = page;
    do {
      try {
        const messages = await listMessages(token, pageToken, pageSize);
        if (messages.messages) {
          console.log("messages.messages------", messages.messages);

          for (const message of messages.messages) {
            const emailContent = await readGmailContent(null,message.id, token);
            allMessages.push(emailContent); // Concatenate or push to allMessages array
          }
          // const emailContent = await  readGmailContent(messages.messages[0].id,token)
          // allMessages = allMessages.concat(emailContent);
        }
        pageToken = messages.nextPageToken;
        currentPage--;
      } catch (error) {
        console.error(`Error fetching messages with token ${token}:`, error);
        // Continue with next token if error occurs
        break;
      }
    } while (pageToken && currentPage > 0);
  }
  return allMessages;
};

const listMessages = async (accessToken, pageToken = null, maxResults = 10) => {
  // const accessToken = await getAccessToken();
  const url = `https://www.googleapis.com/gmail/v1/users/me/messages`;
  const params = {
    access_token: accessToken,
    maxResults: maxResults, // Maximum number of messages per page
    pageToken: pageToken,
  };

  const config = {
    method: "get",
    url: url,
    params: params,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error listing messages: ", error.message);
    throw error;
  }
};

const sendReply = async (req) => {
  const { threadId, message, to, subject, from } = req.body;
  const accessToken = await getAccessToken();
  const data =
    `To: ${to}\n` +
    `Subject: ${subject}\n` +
    `Content-Type: text/plain; charset=utf-8\n` +
    `From: ${from}\n` +
    `${message}`;

  const encodedMessage = Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const url = `https://www.googleapis.com/gmail/v1/users/me/messages/send`;
  const requestBody = {
    raw: encodedMessage,
    threadId: threadId,
  };

  const config = {
    method: "post",
    url: url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    data: requestBody,
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error sending reply: ", error.message);
    throw error;
  }
};

const composeEmail = async (req) => {
  const { message, to, subject, from } = req.body;
  const data =
    `To: ${to}\n` +
    `Subject: ${subject}\n` +
    `Content-Type: text/plain; charset=utf-8\n` +
    `From: ${from}\n` +
    `${message}`;

  const accessToken = await this.getAccessToken();

  const url = `https://www.googleapis.com/gmail/v1/users/me/messages/send`;
  const requestBody = {
    raw: Buffer.from(data)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, ""),
  };

  const config = {
    method: "post",
    url: url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    data: requestBody,
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error composing email: ", error);
    throw error;
  }
};

//  composeEmail = async (message) => {
//   try {
//     const accessToken = await this.getAccessToken();

//     const transport = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         type: 'OAuth2',
//         user: 'nishantgupta9763@gmail.com',
//         clientId: this.client_id,
//         clientSecret: this.client_secret,
//         refreshToken: this.refresh_token,
//         accessToken: accessToken,
//       },
//     });

//     const mailOptions = {
//       from: 'SENDER NAME <nishantgupta9763@gmail.com>',
//       to: 'nishant97636@gmail.com',
//       subject: 'Hello from gmail using API',
//       text: 'Hello from gmail email using API',
//       html: '<h1>Hello from gmail email using API</h1>',
//     };

//     const result = await transport.sendMail(mailOptions);
//     return result;
//   } catch (error) {
//     return error;
//   }
// }

const getLabels = async (req) => {
  const accessToken = await getAccessToken();
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/labels`;
  const config = {
    method: "get",
    url: url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    // data: requestBody,
  };
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error composing email: ", error);
    throw error;
  }
};

const storeCompany = async (req) => {
  const company = await CompanyModel.create(req.body);
  return company;
};

const storeCompanyClients = async (req) => {
  const companyClient = await ClientModel.create(req.body);
  return companyClient;
};

const getCompanyClients = async (companyId) => {
  // const companyClient = await ClientModel.find({ _id: companyId }).sort({
  //   createdAt: -1,
  // });
  // const companyClients = await ClientModel.find({ companyId: companyId }).sort({
  //   createdAt: -1,
  // });
  // return companyClient || companyClients;

  // Fetch the company client by _id
  const companyClient = await ClientModel.find({ _id: companyId }).sort({
    createdAt: -1,
  });
console.log("companyClient=============",companyClient);

  // If no client found by _id, fetch clients by companyId
  if (!companyClient || companyClient.length === 0) {
    const companyClients = await ClientModel.find({
      companyId: companyId,
    }).sort({
      createdAt: -1,
    });
    console.log("companyClients===234=========",companyClients);
    
    return companyClients;
  }

  return companyClient;
};

const getemails = async (req) => {
  const companyClients = await ClientModel.find()
    .sort({ createdAt: -1 })
    .select({ email: 1 });
  const emails = companyClients.filter((client) => client.email); // Filter out entries without emails
  return emails;
};

// }

// module.exports = new GmailService();
module.exports = {
  getAccessToken,
  searchGmail,
  readAllMails,
  listMessages,
  readGmailContent,
  readInboxContent,
  sendReply,
  composeEmail,
  getLabels,
  storeCompany,
  storeCompanyClients,
  getCompanyClients,
  getemails,
};
