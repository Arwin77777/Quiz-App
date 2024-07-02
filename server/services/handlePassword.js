const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;

const clientId = "";
const clientSecret = "";
const redirectUri = "https://developers.google.com/oauthplayground";
const refreshToken = ""; 

const oAuth2Client = new OAuth2(clientId,clientSecret,redirectUri);
oAuth2Client.setCredentials({ refresh_token: refreshToken });

async function sendEmail(email,otp)
{
    try{
        const accessToken = await oAuth2Client.getAccessToken();
        const transport = nodemailer.createTransport({
            service: 'gmail',
            auth : {
                type:'oauth2',
                user : 'arwinsekar213@gmail.com',
                clientId : clientId,
                clientSecret:clientSecret,
                refreshToken:refreshToken,
                accessToken:accessToken
            }
        });

        const mailOptions = {
            from: 'arwinsekar213@gmail.com',
            to: email,
            subject: 'Sending Email using Node.js',
            text: `That was easy! ${otp}`
        };

        const result = await transport.sendMail(mailOptions)
        console.log(result);
        return true;
    }
    catch(err){
        console.log(err);
        return false; 
    }
}

 function generateOtp(){
    const otp = Math.floor(1000 + Math.random() * 9000);
    console.log("Generated OTP: ", otp);
    return otp;
}

module.exports = {sendEmail,generateOtp};