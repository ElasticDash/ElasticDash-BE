import { sendEmailSendPulse } from './email.js';
import { verificationLinkEmailContent } from '../../src/email_templates.js';
import { sender, senderName } from '../../src/constants.js';

export const verificationEmailSender = (email, random_url, url, isRegister = false) => {
    console.log('verificationEmailSender is triggered');
    console.log('email: ', email);
    console.log('random_url: ', random_url);
    console.log('url: ', url);
    console.log('isRegister: ', isRegister);

    const subject = 'Verify your email to use Oyabun';

    const html = verificationLinkEmailContent(random_url, url, isRegister);

    // SendPulse is working
    sendEmailSendPulse(sender, senderName, email, subject, html)
    .catch((err) => {
        console.error('sendEmailSendPulse failed, error: ', err);
        return false;
    });

    return true;
}

export const generalEmailSender = (email, subject, html) => {
    console.log('generalEmailSender is triggered');
    console.log('email: ', email);
    console.log('subject: ', subject);

    // SendPulse is working
    sendEmailSendPulse(sender, senderName, email, subject, html)
    .catch((err) => {
        console.error('sendEmailSendPulse failed, error: ', err);
        return false;
    });

    return true;
}

export const messageNotificationSender = (repoId, messageId, message, messageHistories) => {
    console.log('messageNotificationSender is triggered');
    console.log('repoId: ', repoId);
    console.log('messageId: ', messageId);
    
    const subject = (
        process.env.S3_BUCKET_NAME.includes('test') ?
        '[ElasticDash Test] New Message needs to be processed' :
        '[ElasticDash] New Message needs to be processed'
    );
    
    // Prepare the email content
    let historiesHtml = '';
    if (messageHistories && messageHistories.length > 0) {
        historiesHtml = '<h3>Message History:</h3><ul>';
        messageHistories.forEach(history => {
            historiesHtml += `<li><strong>${history.role}:</strong> ${history.content}</li>`;
        });
        historiesHtml += '</ul>';
    }
    
    const html = `
    <html>
        <body>
            <h2>New Message Notification</h2>
            <p>A new message has been received and needs to be processed.</p>
            <p><strong>Repository ID:</strong> ${repoId}</p>
            <p><strong>Message ID:</strong> ${messageId}</p>
            <p><strong>Message Content:</strong> ${message}</p>
            ${historiesHtml}
            <p>Please review and process this message as soon as possible.</p>
        </body>
    </html>
    `;
    
    // Send the email notification
    sendEmailSendPulse(sender, senderName, 'terryjiang1996@gmail.com', subject, html)
    .catch((err) => {
        console.error('sendEmailSendPulse failed, error: ', err);
        return false;
    });
    
    return true;
}