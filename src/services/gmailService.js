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
  if (req && req.query && req.query.email_id) {
    const { email_id } = req.query;
    companyId = email_id;
  } else {
    companyId = "6669d5e0505bda96774e05d9";
  }
  console.log("req.query=======1==========", companyId);
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
        console.log("response.data=============",response.data);
        
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
  console.log("hiiiiiii-----------------2");
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
    console.log("response-----------", response.data);
    const threadId = response.data; //response.data.messages[0].id;
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
  const threadId = await searchGmail(searchText);
  console.log("threadId===============", threadId);

  const message = await readGmailContent(threadId);
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
            const emailContent = await readGmailContent(
              null,
              message.id,
              token
            );
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
  console.log("accessToken===============", accessToken);

  // const data =
  //   `To: ${to}\n` +
  //   `Subject: ${subject}\n` +
  //   `Content-Type: text/plain; charset=utf-8\n` +
  //   `From: ${from}\n` +
  //   `${message}`;

  const data =
    `To: ${to}\n` +
    `Subject: ${subject}\n` +
    `Content-Type: text/plain; charset=utf-8\n` + // Change to text/html if sending HTML
    `From: ${from}\n` +
    // `In-Reply-To: <${req.body.inReplyTo}>\n` + // Optional: Add In-Reply-To header if replying
    // `References: <${req.body.references}>\n` + // Optional: Add References header if needed
    `\n` + // Add a newline before the message body
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
  console.log("hiiiiiii");
  const companyClient = await ClientModel.find({ _id: companyId }).sort({
    createdAt: -1,
  });
  console.log("companyClient=============", companyClient);

  // If no client found by _id, fetch clients by companyId
  if (!companyClient || companyClient.length === 0) {
    const companyClients = await ClientModel.find({
      companyId: companyId,
    }).sort({
      createdAt: -1,
    });
    console.log("companyClients===234=========", companyClients);

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

const deleteEmails = async (req) => {
  const messageIds = req.body.messageIds; // Expecting an array of message IDs

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    throw new Error("No message IDs provided or messageIds is not an array.");
  }
  const accessToken = await getAccessToken();

  const urlBase = `https://gmail.googleapis.com/gmail/v1/users/me/messages`;

  const requests = messageIds.map((messageId) => {
    const url = `${urlBase}/${messageId}`;

    const requestBody = {
      // removeLabelIds: ["INBOX"], // Optionally remove "INBOX"
      addLabelIds: ["UNREAD"], // Mark as "UNREAD"
    };

    const config = {
      method: "delete",
      url: url,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: requestBody,
    };

    return axios(config)
      .then(() => {
        console.log(
          `Email with ID ${messageId} marked as unread successfully.`
        );
      })
      .catch((error) => {
        console.error(
          `Error marking email with ID ${messageId} as unread:`,
          error.message
        );
        // Optionally, you could handle the error here, like logging it or storing the failed IDs
      });
  });

  // Execute all requests in parallel
  await Promise.all(requests);

  return true; // Return true if all operations were successful
};

const markUnreadEmails = async (req) => {
  const messageIds = req.body.messageIds; // Expecting an array of message IDs

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    throw new Error("No message IDs provided or messageIds is not an array.");
  }
  const accessToken = await getAccessToken();

  const urlBase = `https://gmail.googleapis.com/gmail/v1/users/me/messages`;

  const requests = messageIds.map((messageId) => {
    const url = `${urlBase}/${messageId}/modify`;

    const requestBody = {
      // removeLabelIds: ["INBOX"], // Optionally remove "INBOX"
      addLabelIds: ["UNREAD"], // Mark as "UNREAD"
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

    return axios(config)
      .then(() => {
        console.log(
          `Email with ID ${messageId} marked as unread successfully.`
        );
      })
      .catch((error) => {
        console.error(
          `Error marking email with ID ${messageId} as unread:`,
          error.message
        );
        // Optionally, you could handle the error here, like logging it or storing the failed IDs
      });
  });

  // Execute all requests in parallel
  await Promise.all(requests);

  return true; // Return true if all operations were successful
};

const forwardMessage = async (req) => {
  const { messageId, to, subject, from } = req.body;
  const accessToken = await getAccessToken();
  console.log("accessToken===============", accessToken);

  // Fetch the original message content
  const originalMessageResponse = await axios.get(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const originalMessage = originalMessageResponse.data;
  console.log("originalMessage=",originalMessage);
  
  const originalMessageContent = originalMessage.payload.body.data;
  const decodedOriginalMessage = Buffer.from(originalMessageContent, 'base64').toString('ascii');

  // Prepare the forwarded message
  const data =
    `To: ${to}\n` +
    `Subject: Fwd: ${subject}\n` +
    `Content-Type: text/plain; charset=utf-8\n` +
    `From: ${from}\n` +
    `\n` +
    `Forwarded message:\n\n` +
    `${decodedOriginalMessage}`;

  console.log("data===============", data);

  const encodedMessage = Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const url = `https://www.googleapis.com/gmail/v1/users/me/messages/send`;
  const requestBody = {
    raw: encodedMessage,
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
    console.error("Error forwarding message: ", error.message);
    throw error;
  }
};


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
  deleteEmails,
  markUnreadEmails,
  forwardMessage
};

// const axios = require("axios");
// const qs = require("qs");
// const { getTokenFromDB, saveTokenToDB } = require("./tokenStorage"); // Your DB functions

// const getAccessToken = async (companyId) => {
//   // Check if there's a valid token in the database
//   let tokenData = await getTokenFromDB(companyId);

//   // If token exists and is still valid, return it
//   if (tokenData && tokenData.expires_at > Date.now()) {
//     console.log("Using cached token");
//     return tokenData.access_token;
//   }

//   // Otherwise, generate a new token
//   const findClientCred = await getCompanyClients(companyId);
//   const client = findClientCred[0]; // Assuming one client for simplicity

//   const data = qs.stringify({
//     client_id: client.client_id,
//     client_secret: client.client_secret,
//     refresh_token: client.refresh_token,
//     grant_type: "refresh_token",
//   });

//   const config = {
//     method: "post",
//     url: "https://oauth2.googleapis.com/token",
//     headers: {
//       "Content-Type": "application/x-www-form-urlencoded",
//     },
//     data: data,
//   };

//   try {
//     const response = await axios(config);
//     const accessToken = response.data.access_token;
//     const expiresIn = response.data.expires_in * 1000; // Convert to milliseconds

//     // Calculate the expiration time
//     const expiresAt = Date.now() + expiresIn;

//     // Save the token and expiration time to the database
//     await saveTokenToDB(companyId, accessToken, expiresAt);

//     return accessToken;
//   } catch (error) {
//     console.error("Error getting access token: ", error.message);
//     throw error;
//   }
// };

// // Example function to get the token from the database
// async function getTokenFromDB(companyId) {
//   // Fetch the token from your database
//   // Return an object like { access_token: '...', expires_at: 1234567890 }
// }

// // Example function to save the token to the database
// async function saveTokenToDB(companyId, accessToken, expiresAt) {
//   // Save the token and its expiration time to your database
// }
