// AWS Lambda entry behind the contact form's function URL. The message leaves through Amazon SES
// under the function's own IAM role, so no mail password exists.
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { createLambdaHandler } from "./lambda.js";
import { createContactHandler } from "./message.js";
import { createRecaptchaVerifier } from "./recaptcha.js";

const ses = new SESv2Client({ region: process.env.SES_REGION });

async function sendMail(mail) {
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: mail.from,
      Destination: { ToAddresses: [mail.to] },
      ReplyToAddresses: [mail.replyTo],
      Content: {
        Simple: {
          Subject: { Data: mail.subject, Charset: "UTF-8" },
          Body: { Text: { Data: mail.text, Charset: "UTF-8" } },
        },
      },
    }),
  );
}

const allowedHosts = (process.env.CONTACT_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

export const handler = createLambdaHandler(
  createContactHandler({
    env: process.env,
    sendMail,
    verifyCaptcha: createRecaptchaVerifier(process.env.RECAPTCHA_SECRET),
    allowedHosts,
  }),
);
