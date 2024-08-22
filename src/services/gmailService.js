const axios = require("axios");
const qs = require("qs");
// const nodemailer = require("nodemailer");
const ClientModel = require("../models/client.model");
const CompanyModel = require("../models/company.model");
const SessionModel = require("../models/session.model");

// const qs = require("qs");
// const { getTokenFromDB, saveTokenToDB } = require("./tokenStorage"); // Your DB functions

const getAccessToken = async (emailId) => {
  let tokenData = await getTokenFromDB(emailId);
  if (tokenData && tokenData.expiresAt > Date.now()) {
    return tokenData.accessToken;
  }
  const findClientCred = await ClientModel.findOne({ _id: emailId });

  const data = qs.stringify({
    client_id: findClientCred.client_id,
    client_secret: findClientCred.client_secret,
    refresh_token: findClientCred.refresh_token,
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
    const accessToken = response.data.access_token;
    const expiresIn = response.data.expires_in * 1000; // Convert to milliseconds

    // Calculate the expiration time
    const expiresAt = Date.now() + expiresIn;

    // Save the token and expiration time to the database
    await saveTokenToDB(emailId, accessToken, expiresAt);

    return accessToken;
  } catch (error) {
    console.error("Error getting access token: ", error.message);
    throw error.message;
  }
};

// Example function to get the token from the database
async function getTokenFromDB(emailId) {
  const findSession = await SessionModel.findOne({ emailId: emailId });
  if (!findSession) {
    return null;
  }
  return findSession;
}

// Example function to save the token to the database
async function saveTokenToDB(emailId, accessToken, expiresAt) {
  let createSession;
  const findSession = await SessionModel.findOne({ emailId: emailId });
  if (findSession) {
    createSession = await SessionModel.findOneAndUpdate(
      { emailId: emailId },
      { accessToken: accessToken, expiresAt: expiresAt },
      { new: true }
    );
  } else {
    createSession = await SessionModel.create({
      emailId: emailId,
      accessToken: accessToken,
      expiresAt: expiresAt,
    });
  }
  return createSession;
}

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

const getAccessTokens = async (req) => {
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
        console.log("response.data=============", response.data);

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
  if (!accessToken) {
    accessToken = await getAccessToken(req.params.emailId);
  }
  const config = {
    method: "get",
    url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
  try {
    const response = await axios(config);
    const singleMails = response.data;
    // console.log("singleMails=============",singleMails.payload.headers);

    // Extract recipients from the original message
    const headers = singleMails.payload.headers;
    const to = headers.find((header) => header.name === "To")?.value || "";
    const cc = headers.find((header) => header.name === "Cc")?.value || "";
    const bcc = headers.find((header) => header.name === "Bcc")?.value || "";
    const from = headers.find((header) => header.name === "From")?.value || "";
    const subject =
      headers.find((header) => header.name === "Subject")?.value || "";
    const emailMetadata = {
      to,
      cc,
      bcc,
      from,
      subject,
    };
    singleMails.emailMetadata = emailMetadata;
    return singleMails;
  } catch (error) {
    console.error("Error reading Gmail content: ", error.message);
    throw error;
  }
};

const readInboxContent = async (searchText) => {
  const threadId = await searchGmail(searchText);
  console.log("threadId===============", threadId);

  const message = await readGmailContent(threadId);
  const encodedMessage = message.payload.parts[0].body.data;
  const decodedStr = Buffer.from(encodedMessage, "base64").toString("ascii");
  return decodedStr;
};

// const readAllMails = async (req, page = 1, pageSize = 10) => {
//   let allMessages = [];
//   let nextPageToken = null;
//   let accessTokens;

//   try {
//     accessTokens = await getAccessToken(req.params.emailId);
//   } catch (error) {
//     console.error("Failed to get access tokens:", error);
//     throw error;
//   }
//   let pageToken = null;
//   let currentPage = page;
//   do {
//     try {
//       const messages = await listMessages(accessTokens, pageToken, pageSize);
//       if (messages.messages) {
//         for (const message of messages.messages) {
//           const emailContent = await readGmailContent(
//             null,
//             message.id,
//             accessTokens
//           );
//           allMessages.push(emailContent); // Concatenate or push to allMessages array
//         }
//       }
//       pageToken = messages.nextPageToken;
//       currentPage--;
//     } catch (error) {
//       console.error(
//         `Error fetching messages with token ${accessTokens}:`,
//         error
//       );
//       break;
//     }
//   } while (pageToken && currentPage > 0);
//   return allMessages;
// };

const readAllMails = async (req, page = 1, pageSize = 10) => {
  const { type = "all", search = "" } = req.query;
  let allMessages = [];
  let totalMessages = 0;
  let pageToken = null;

  try {
    const accessTokens = await getAccessToken(req.params.emailId);

    // Construct search query based on type
    const typeQueryMap = {
      unread: " is:unread",
      sent: " in:sent",
      inbox: " in:inbox",
    };
    const searchQuery = search + (typeQueryMap[type] || "");

    const startIndex = (page - 1) * pageSize;
    let fetchedMessages = [];

    // Fetch only the necessary number of pages
    do {
      const messages = await listMessages(
        accessTokens,
        searchQuery,
        pageToken,
        pageSize
      );

      if (messages.messages) {
        fetchedMessages.push(...messages.messages);
      }

      pageToken = messages.nextPageToken;

      if (messages.resultSizeEstimate) {
        totalMessages = messages.resultSizeEstimate;
      }

      if (!pageToken || fetchedMessages.length >= startIndex + pageSize) {
        break;
      }
    } while (pageToken);

    // Calculate totalPages
    const totalPages = Math.ceil(totalMessages / pageSize);

    // Extract the required messages for the current page
    const paginatedMessages = fetchedMessages.slice(
      startIndex,
      startIndex + pageSize
    );

    // Fetch full email content and extract required fields
    const formattedMessages = await Promise.all(
      paginatedMessages.map(async (message) => {
        const emailContent = await readGmailContent(
          null,
          message.id,
          accessTokens
        );

        // const headers = {};
        // emailContent.payload.headers.forEach((header) => {
        //   switch (header.name) {
        //     case "Delivered-To":
        //       headers.to = header.value;
        //       break;
        //     case "From":
        //       headers.from = header.value;
        //       break;
        //     case "Subject":
        //       headers.subject = header.value;
        //       break;
        //     case "Date":
        //       headers.date = header.value;
        //       break;
        //     // Add more cases for other headers if needed
        //     default:
        //       break;
        //   }
        // });
        const headers = emailContent.payload.headers.reduce((acc, header) => {
          const { name, value } = header;
          if (["Delivered-To", "From", "Subject", "Date"].includes(name)) {
            acc[name.toLowerCase()] = value;
          }
          return acc;
        }, {});

        return {
          id: emailContent.id,
          threadId: emailContent.threadId,
          labelIds: emailContent.labelIds,
          snippet: emailContent.snippet,
          headers: headers,
        };
      })
    );

    return {
      messages: formattedMessages,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        hasNextPage: !!pageToken,
        pageSize: pageSize,
        totalMessages: totalMessages,
      },
    };
  } catch (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }
};

const listMessages = async (
  accessToken,
  searchQuery = "",
  pageToken = null,
  maxResults = 10
) => {
  // const accessToken = await getAccessToken();
  const url = `https://www.googleapis.com/gmail/v1/users/me/messages`;
  const params = {
    access_token: accessToken,
    maxResults: maxResults, // Maximum number of messages per page
    pageToken: pageToken,
    q: searchQuery, // Include the search query in the request
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
  const accessToken = await getAccessToken(req.params.emailId);
  // const data =
  //   `To: ${to}\n` +
  //   `Subject: ${subject}\n` +
  //   `Content-Type: text/plain; charset=utf-8\n` +
  //   `From: ${from}\n` +
  //   `${message}`;

  const data =
    `To: ${to}\n` +
    `Cc: ${cc}\n` +
    `Bcc: ${bcc}\n` +
    `Subject:  Re: ${subject}\n` +
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
  const searchQuery = req.query.search || ""; // Get the search query from request params
  const regexQuery = new RegExp(searchQuery, "i"); // Create a case-insensitive regex for partial matching

  // Fetch clients with the matching emails
  const companyClients = await ClientModel.find({ email: regexQuery })
    .sort({ createdAt: -1 })
    .select({ email: 1 });

  // Return the filtered list of emails
  const emails = companyClients.filter((client) => client.email); // Filter out entries without emails
  return emails;
};

const deleteEmails = async (req) => {
  const messageIds = req.body.messageIds; // Expecting an array of message IDs

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    throw new Error("No message IDs provided or messageIds is not an array.");
  }
  const accessToken = await getAccessToken(req.params.emailId);

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
  const accessToken = await getAccessToken(req.params.emailId);

  const urlBase = `https://gmail.googleapis.com/gmail/v1/users/me/messages`;

  const requests = messageIds.map((messageId) => {
    const url = `${urlBase}/${messageId}/modify`;

    const requestBody =
      req.body.markAs === "unread"
        ? { addLabelIds: ["UNREAD"] }
        : { removeLabelIds: ["UNREAD"] };

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
  const accessToken = await getAccessToken(req.params.emailId);
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
  let decodedOriginalMessage = "";

  if (originalMessage.payload.body && originalMessage.payload.body.data) {
    // Plain text message
    decodedOriginalMessage = Buffer.from(
      originalMessage.payload.body.data,
      "base64"
    ).toString("ascii");
  } else if (originalMessage.payload.parts) {
    // Multipart message
    // You may need to iterate over parts to find the desired content
    decodedOriginalMessage = originalMessage.payload.parts
      .filter((part) => part.mimeType === "text/plain")
      .map((part) => Buffer.from(part.body.data, "base64").toString("ascii"))
      .join("\n");
  }
  const toAddresses = Array.isArray(to) ? to.join(", ") : to;
  // Prepare the forwarded message
  const data =
    `To: ${toAddresses}\n` +
    `Subject: Fwd: ${subject}\n` +
    `Content-Type: text/plain; charset=utf-8\n` +
    `From: ${from}\n` +
    `\n` +
    `Forwarded message:\n\n` +
    `${decodedOriginalMessage}`;

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

const updateEmails = async (req) => {
  try {
    const updateClients = await ClientModel.findOneAndUpdate(
      { _id: req.params.emailId },
      { email: req.body.email },
      { new: true }
    ).select({ email: 1 });
    return updateClients;
  } catch (error) {
    throw error;
  }
};

const deleteLocalEmail = async (req) => {
  try {
    const emailIds = req.body.emailIds;

    // Ensure emailIds is an array
    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      throw new Error("Invalid email IDs provided.");
    }

    // Update the isDeleted field to true for the specified email IDs
    const deleteClients = await ClientModel.updateMany(
      { _id: { $in: emailIds } },
      { $set: { isDeleted: true } },
      { new: true }
    );

    // Check if the update was successful
    if (deleteClients.modifiedCount === 0) {
      throw new Error("No emails were updated. Please check the provided IDs.");
    }

    return true;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  // getAccessToken,
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
  forwardMessage,
  updateEmails,
  deleteLocalEmail,
};
