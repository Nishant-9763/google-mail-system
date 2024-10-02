const axios = require("axios");
const qs = require("qs");
// const nodemailer = require("nodemailer");
const ClientModel = require("../models/client.model");
const CompanyModel = require("../models/company.model");
const SessionModel = require("../models/session.model");
const { google } = require("googleapis");

// Set up the OAuth2 client with your credentials
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID, // Replace with your client ID
  process.env.CLIENT_SECRET, // Replace with your client secret
  process.env.REDIRECT_URL // Replace with your redirect URI
);

// Define the scopes you need
const SCOPES = [
  process.env.SCOPES_FOR_EMAIL,
  process.env.SCOPES_FOR_PROFILE,
  process.env.SCOPES_FOR_COMPOSE,
];

// API endpoint to initiate OAuth
const auth = async (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // select_account
  });
  return authUrl;
};

// API endpoint to handle OAuth callback and exchange code for tokens
const oauth2callback = async (req, res) => {
  const { code } = req.body; // query
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    // console.log("Tokens:", tokens);

    // Fetch user profile information
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });

    const userInfo = await oauth2.userinfo.get();
    // console.log("User Info:", userInfo.data);
    const payload = {
      refresh_token: tokens.refresh_token,
      accessToken: tokens.access_token,
      email: userInfo.data.email,
      expiresAt: tokens.expiry_date,
      scope: tokens.scope,
    };
    const companyClient = await ClientModel.create(payload);
    return companyClient;
  } catch (error) {
    console.error("Error retrieving access token:", error);
    // res.status(500).json({ error: "Authentication failed" });
    throw error;
  }
};

const getAccessToken = async (emailId) => {
  if (!emailId) {
    return res.status(400).send("Refresh token is required");
  }
  let tokenData = await getTokenFromDB(emailId);

  if (tokenData && tokenData.expiresAt > Date.now()) {
    return tokenData.accessToken;
  }
  const findClientCred = await ClientModel.findOne({ _id: emailId });
  try {
    oauth2Client.setCredentials({
      refresh_token: findClientCred.refresh_token,
    });
    const response = await oauth2Client.refreshAccessToken();
    const credentials = response.credentials;

    const access_token = credentials.access_token;
    const expiresAt = credentials.expiry_date; // Convert to milliseconds

    // Save the token and expiration time to the database
    await saveTokenToDB(emailId, access_token, expiresAt);

    return access_token;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    // res.status(500).send("Could not refresh access token");
    throw error;
  }
};

// Function to refresh the access token
async function refreshAccessToken(refreshToken) {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  try {
    const response = await oauth2Client.refreshAccessToken();
    const credentials = response.credentials;

    return credentials;
  } catch (error) {
    throw new Error("Could not refresh access token");
  }
}

const getAccessTokens = async (emailId) => {
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
  const findSession = await ClientModel.findOne({ _id: emailId });
  if (!findSession) {
    return null;
  }
  return findSession;
}

// Example function to save the token to the database
async function saveTokenToDB(emailId, accessToken, expiresAt) {
  let createSession;
  const findSession = await ClientModel.findOne({ _id: emailId });
  if (findSession) {
    createSession = await ClientModel.findOneAndUpdate(
      { _id: emailId },
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

const readAllMails = async (req, page = 1, pageSize = 10) => {
  const { type = "all", search = "" } = req.query;
  let totalMessages = 0;
  let pageToken = null;
  let allMessages = [];

  try {
    const accessTokens = await getAccessToken(req.params.emailId);
    // Construct search query based on type
    const typeQueryMap = {
      unread: " is:unread",
      sent: " in:sent",
      inbox: " in:inbox",
      spam: " in:spam", // Fetch Spam messages
      trash: " in:trash", // Fetch Trash messages (deleted emails)
      draft: " in:drafts", // Fetch Draft messages
    };
    const searchQuery = search + (typeQueryMap[type] || "");

    let fetchedMessages = [];

    // Fetch messages and apply pagination
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
      totalMessages = messages.resultSizeEstimate || 0;

      // Break the loop if we have enough messages for the current page
      if (fetchedMessages.length >= page * pageSize) {
        break;
      }
    } while (pageToken);

    // Calculate start and end index for current page
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    // Extract the messages for the current page
    const paginatedMessages = fetchedMessages.slice(startIndex, endIndex);

    // Fetch full email content and extract required fields
    const formattedMessages = await Promise.all(
      paginatedMessages.map(async (message) => {
        const emailContent = await readGmailContent(
          null,
          message.id,
          accessTokens
        );
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
        totalPages: Math.ceil(totalMessages / pageSize),
        hasNextPage: fetchedMessages.length > page * pageSize,
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
    q: `/"${searchQuery}"/`, // Include the search query in the request
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
  const { threadId, message, to, subject, from, cc, bcc } = req.body;
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
  console.log(
    "message===",
    message,
    "to====",
    to,
    "subject====",
    subject,
    "from=====",
    from
  );

  const data =
    `To: ${to}\n` +
    `Subject: ${subject}\n` +
    `Content-Type: text/plain; charset=utf-8\n` +
    `From: ${from}\n` +
    `${message}`;

  const accessTokens = await getAccessToken(req.params.emailId);

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
      Authorization: `Bearer ${accessTokens}`,
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

const saveDraft = async (req) => {
  const { message, to, subject, from } = req.body;

  const findEmail = await ClientModel.findOne({ id: req.params.emailId });

  // Compose the raw email data
  const data =
    `To: ${to}\n` +
    `Subject: ${subject}\n` +
    `Content-Type: text/plain; charset=utf-8\n` +
    `From: ${findEmail.email}\n\n` +
    `${message}`;

  // Get access token (assuming you have an existing function to get this)
  const accessTokens = await getAccessToken(req.params.emailId);

  // Prepare the raw email in base64 format and replace URL-safe characters
  const requestBody = {
    message: {
      raw: Buffer.from(data)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, ""), // URL-safe base64 encoding
    },
  };

  // Gmail API URL for creating a draft
  const url = `https://www.googleapis.com/gmail/v1/users/me/drafts`;

  const config = {
    method: "post",
    url: url,
    headers: {
      Authorization: `Bearer ${accessTokens}`,
      "Content-Type": "application/json",
    },
    data: requestBody,
  };

  try {
    const response = await axios(config);
    return response.data; // Return the draft response from Gmail
  } catch (error) {
    console.error("Error creating email draft: ", error);
    throw error;
  }
};

const updateDraft = async (req) => {
  const { draftId, message, to, subject, from } = req.body;
  const findEmail = await ClientModel.findOne({ id: req.params.emailId });
  const data =
    `To: ${to}\n` +
    `Subject: ${subject}\n` +
    `Content-Type: text/plain; charset=utf-8\n` +
    `From: ${findEmail.email}\n\n` +
    `${message}`;

  const accessToken = await getAccessToken(req.params.emailId);

  const url = `https://www.googleapis.com/gmail/v1/users/me/drafts/${draftId}`;
  const requestBody = {
    message: {
      raw: Buffer.from(data)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, ""),
    },
  };

  const config = {
    method: "put",
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
    console.error("Error updating draft: ", error.message);
    throw error;
  }
};

const listDrafts = async (req) => {
  const accessToken = await getAccessToken(req.params.emailId);
  const url = `https://www.googleapis.com/gmail/v1/users/me/drafts`;

  const config = {
    method: "get",
    url: url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };

  try {
    const response = await axios(config);
    return response.data.drafts; // This will give you an array of draft objects
  } catch (error) {
    console.error("Error listing drafts: ", error.message);
    throw error;
  }
};

const getSingleDraft = async (req) => {
  const accessToken = await getAccessToken(req.params.emailId);
  const url = `https://www.googleapis.com/gmail/v1/users/me/drafts/${req.params.draftId}`;

  const config = {
    method: "get",
    url: url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await axios(config);
    return response.data; // Returns the draft data
  } catch (error) {
    console.error("Error fetching draft: ", error.message);
    throw error;
  }
};

const sendDraft = async (req) => {
  const accessToken = await getAccessToken(req.params.emailId);
  const url = `https://www.googleapis.com/gmail/v1/users/me/drafts/send`;

  const requestBody = {
    id: req.params.draftId,
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
    return response.data; // Email is sent, and draft is removed from drafts
  } catch (error) {
    console.error("Error sending draft: ", error.message);
    throw error;
  }
};

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
  const companyClients = await ClientModel.find({
    email: regexQuery,
    isDeleted: false,
  })
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
    // const deleteClients = await ClientModel.updateMany(
    //   { _id: { $in: emailIds } },
    //   { $set: { isDeleted: true } },
    //   { new: true }
    // );
     // Delete the specified email IDs
     const deleteClients = await ClientModel.deleteMany(
      { _id: { $in: emailIds } }
    );

    // Check if the update was successful
    // if (deleteClients.modifiedCount === 0) {
    //   throw new Error("No emails were updated. Please check the provided IDs.");
    // }

    // Check if any emails were deleted
    if (deleteClients.deletedCount === 0) {
      throw new Error("No emails were deleted. Please check the provided IDs.");
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
  saveDraft,
  listDrafts,
  sendDraft,
  updateDraft,
  getSingleDraft,
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
  // genrateToken,
  auth,
  oauth2callback,
};
