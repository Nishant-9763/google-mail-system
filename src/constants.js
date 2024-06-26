require('dotenv');

const auth = {
    type: 'OAuth2',
    user: 'nishantgupta9763@gmail.com',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
};

const mailOptions = {    
    to: '<RECIPIENT_MAIL_ID>',
    from: 'nishantgupta9763@gmail.com',
    subject: 'Gmail API using Node JS',
};

module.exports = {
    auth,
    mailOptions
}