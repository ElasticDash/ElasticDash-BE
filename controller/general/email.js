import axios from 'axios';

export const sendEmailSendPulse = (sender, senderName, receiver, subject, html, attachments) => {
    console.log('sendEmailSendPulse is triggered');
    console.log('sender: ', sender);
    console.log('senderName: ', senderName);
    console.log('receiver: ', receiver);
    console.log('subject: ', subject);
    let buff = Buffer.from(html);
    let base64data = buff.toString('base64');
    if (!attachments) {
        attachments = [];
    }

    return new Promise((resolve, reject) => {
        try {

            return sendPulseAuthentication().then(auth => {
                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': auth.token_type + ' ' + auth.access_token
                }
                const data = {
                    "email": {
                        "html": base64data,
                        "subject": subject,
                        "from": {
                            "email": sender,
                            "name": senderName
                        },
                        "to": [
                            {
                                "email": receiver
                            }
                        ],
                        "attachments_binary": attachments
                    }
                }
            
                const url = 'https://api.sendpulse.com/smtp/emails';

                return axios.post(url, data, { headers: headers }).then((res) => {
                    console.log('Email sent through SendPulse. Status: ', res.status);
                    console.log('Email was sent to: ', receiver);
                    resolve();
                })
                .catch((err) => {
                    console.error('sendpulse API failed, error: ', err);
                    reject(err);
                });
            })
        }
        catch(err) {
            console.error('sendEmailSendPulse failed, error: ', err);
            reject(err);
        }
    })
    
}

function sendPulseAuthentication() {
    console.log('sendPulseAuthentication is triggered');

    const data = {
        "grant_type": process.env.SENDPULSE_GRANT_TYPE,
        "client_id": process.env.SENDPULSE_CLIENT_ID,
        "client_secret": process.env.SENDPULSE_CLIENT_SECRET,
    }
    
    const url = 'https://api.sendpulse.com/oauth/access_token';
    
    return new Promise((resolve, reject) => {
        axios.post(url, data).then((res) => {
            if (res.status === 200) {
                resolve(res.data);
            }
            else {
                reject(res);
            }
        })
        .catch((err) => {
            console.error('sendPulseAuthentication failed, error: ', err);
            reject(err);
        })
    })
}