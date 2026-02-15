import { pool } from '../../postgres';
import * as crypto from '../auth/crypto';
import * as auth from '../auth/auth';
import { uploadBuffer } from '../general/file';
import gm from 'gm';
import axios from 'axios';
import { verificationEmailSender, generalEmailSender } from '../general/emailsender';
import { resetPassswordEmailContent } from '../../src/email_templates';
import { snake2Camel } from '../general/tools';
import { PAGE_SIZE } from '../../src/constants';
const qs = require('qs');

let graphicsMagick = gm.subClass({ graphicsMagick: true });
const uuidv1 = require('uuid/v1');

import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;

const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

export const createNewUser = async req => {
    console.log('createNewUser is triggered');
    console.log('req: ', req);
    req.password = req.password ? crypto.saltHashPassword(req.password) : null;
    req.created = Date.now().toString();
    req.lastActive = Date.now().toString();
    // req.username = req.username.replace(/-/g, '');
    // console.log('req.username: ', req.username);

    const random_code = Math.floor((Math.random() * 9 + 1) * 100000).toString();
    if (req.email) {
        req.email = req.email.replace(/ /g, '').toLowerCase();
    }
    if (req.username === null || req.username === undefined || req.username === '') {
        const uuid = uuidv1();
        req.username = 'reg' + uuid.replace(/-/g, '') + new Date().getTime();
    }
    if (!req.identity) {
        req.identity = null;
    }

    const check_query = `
        SELECT count(*)::int AS count 
        FROM Users 
        WHERE email = $1 
        AND email_verified = true
        AND deleted = false;
    `;

    const check_values = [req.email];

    const check_result = await pool.query(check_query, check_values);
    if (check_result.rowCount !== 0 && check_result.rows[0].count !== 0) {
        console.log('Email is already used by others. Aborting. ');
        return 403;
    }

    var english = /^[A-Za-z]*$/;

    if (english.test(req.fullName.charAt(0))) {
        let randomPhoto = (Math.round(Math.random() * 5));
        if (randomPhoto === 0) {
            randomPhoto = 1;
        }

        const capital = req.fullName.charAt(0).toUpperCase();

        if (req.photoUrl === null || req.photoUrl === undefined) {
            req.photoUrl = 'random_photos/' + capital + '/' + capital + randomPhoto.toString() + '.png';
        }
    }
    else {
        req.photoUrl = 'random_photos/random_photos/' + (Math.random() * 32).toFixed(0) + '.png';
    }
    req.username = req.username.replace(/-/g, '')
    console.log('req after modified: ', req);
    const query = `INSERT INTO Users (
        role_id,
        username,
        password,
        full_name,
        email,
        validating_code,
        created_at, 
        updated_at, 
        created_by,
        updated_by
    ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        now(),
        now(),
        0,
        0
    )
    RETURNING *;
    `;

    const unsubscribe_unique_url_query = `
    INSERT INTO UnsubscriptionUniqueUrls 
    (email, url, user_id, created_by, updated_by) 
    VALUES 
    ($1, $2, $3, $3, $3) 
    RETURNING *;
    `;

    var uuid = uuidv1();
    uuid = uuid.replace(/-/g, '');

    let uuid2 = uuidv1();
    uuid2 = uuid2.replace(/-/g, '');

    const verify_query = `
    INSERT INTO EmailVerifyLinks
    (email, url, user_id, valid_before, created_at)
    VALUES
    ($1, $2, $3, now() + interval '5 minutes', now())
    RETURNING created_at;
    `;

    const notification_query = `
        INSERT INTO Notifications
        (user_id, type_id, item_id, title, content, created_by, updated_by)
        VALUES
        ($1, 6, 0, 'Welcome!!!', 'Welcome to Oyabun! Let''s get started!', 0, 0),
        ($1, 5, 0, 'Important!!!', 'You''ve received 1 month free trail for Pro Plan.', 0, 0);
    `;

    // const skip_verify_query = `
    // UPDATE Users 
    // SET email_verified = true
    // WHERE id = $1;
    // `;

    const random_url = Math.floor((Math.random() * 9 + 1) * 100000).toString() + new Date().getTime();

    const values = [
        req.role,
        req.username,
        req.password,
        req.fullName,
        req.email,
        random_code
    ];

    return pool.query(query, values)
    .then(results => {
        const userId = results.rows[0].id;
        console.log('user created: ', results.rows);
        const unsubscribe_unique_url_values = [req.email, uuid2, userId];
        return new Promise(resolve => {
            // return pool.query(verify_query, verify_values).then(() => {

                console.log('req.email: ', req.email);
                if (req.email) {
                    console.log('creating unsubscribe unique url');
                    return pool.query(unsubscribe_unique_url_query, unsubscribe_unique_url_values).then(uuu => {
                        console.log('success unsubscribe url');
                        const verify_values = [
                            req.email,
                            random_url,
                            userId
                        ];

                        const notification_values = [userId];

                        return pool.query(notification_query, notification_values)
                        .then(() => {
                            return pool.query(verify_query, verify_values).then(async () => {
                                const url = await getUnsubscribeUrlByUserId(userId);
                                insertTeamMember(userId, 1);
                                verificationEmailSender(req.email, random_url, url, true);
                                console.log('verificationEmailSender successful.');
                                resolve({
                                    success: true
                                });
    
                                // return auth.oauthLogin(userId).then(u => {
                                //     u.id = userId;
                                //     resolve(u);
                                // });
                            })
                            .catch(err => {
                                console.error('verify_query failed, error: ', err);
                                throw typeof err == 'number' ? err : 500;
                            })
                        })
                        .catch(err => {
                            console.error('notification_query failed, error: ', err);
                            throw typeof err == 'number' ? err : 500;
                        })
                    })
                    .catch(err => {
                        console.error('unsubscribe_unique_url_query failed, error: ', err);
                        throw typeof err == 'number' ? err : 500;
                    })
                }
                else {
                    resolve({ status: 200, id: userId, oauth: false });
                }
            // })
            // .catch(err => {
            //     console.error('verify_query failed, error: ', err);
            // })
        })
    })
    .catch(err => {
        console.error('query failed, error: ', err);
    })
};

export const googleAuth = async (req) => {
    console.log('googleAuth is triggered');
    console.log('req: ', req);

    const results = await getAccessTokenGoogle(req.code);

    const update_query = `
        UPDATE UserOAuthTokens
        SET token = $1,
        refresh_token = $2,
        token_expires = $3,
        email_address = $4,
        updated_at = now(),
        updated_by = $5
        WHERE user_id = $5
        AND platform_id = 1
        RETURNING *;
    `;

    const update_values = [
        results.accessToken,
        results.refreshToken,
        results.expiryDate,
        results.email,
        req.myId
    ];

    const query = `
        INSERT INTO UserOAuthTokens
        (
            user_id, platform_id, email_address,
            token, refresh_token, token_expires,
            created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $1, $1)
        RETURNING *;
    `;

    const values = [
        req.myId,
        1,
        results.email,
        results.accessToken,
        results.refreshToken,
        results.expiryDate
    ];

    return pool.query(update_query, update_values)
    .then(async r => {
        if (r.rowCount === 0) {

            return pool.query(query, values)
                .then(async results => {
                    if (results.rowCount === 0) {
                        console.error('user not exist');
                        return 404;
                    }
                    else {
                        const oauthToken = await auth.oauthLogin(req.myId).then(u => {
                            u.id = req.myId;
                            return u;
                        });

                        const result = {
                            ...results.rows[0],
                            ...oauthToken
                        }

                        return result;
                    }
                })
                .catch((err) => {
                    console.error('query error: ', err);
                    return 500;
                });
        }
        else {

            const oauthToken = await auth.oauthLogin(req.myId).then(u => {
                u.id = req.myId;
                return u;
            });

            const result = {
                ...r.rows[0],
                ...oauthToken
            }

            return result;
        }
    })
    .catch((err) => {
        console.error('query error: ', err);
        return 500;
    });
}

async function getAccessTokenGoogle(code) {
    console.log('getAccessTokenGoogle is triggered');

    const tokens = await oAuth2Client.getToken(code);
    const accessToken = tokens.tokens.access_token;
    const refreshToken = tokens.tokens.refresh_token;
    const expiryDate = tokens.tokens.expiry_date;

    const email = await getUserEmailGoogle(accessToken);

    const firstEmailContent = await getFirstEmailContentGoogle(accessToken, 'help@nzflatmates.co.nz');

    console.log('firstEmailContent: ', firstEmailContent);

    const result = {
        accessToken, refreshToken, expiryDate: new Date(expiryDate), email
    };

    console.log('result: ', result);

    return result;
}

async function getUserEmailGoogle(accessToken) {
    oAuth2Client.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
    const response = await oauth2.userinfo.get();

    return response.data.email;
}

async function getFirstEmailContentGoogle(accessToken, targetedEmailAddress) {
    oAuth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const now = new Date();

    // Set the current time to yesterday at 00:00 UTC and convert to seconds
    const yesterday = Math.floor(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0)).getTime() / 1000);

    // Set the time to the day before yesterday at 00:00 UTC and convert to seconds
    const dayBeforeYesterday = Math.floor(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2, 0, 0, 0)).getTime() / 1000);

    // List the user's messages (first email in the inbox)
    const listResponse = await gmail.users.messages.list({
        userId: 'me',
        // maxResults: 1,
        q: `is:inbox from:${targetedEmailAddress}`
        // q: `is:inbox from:${targetedEmailAddress} after:${dayBeforeYesterday} before:${yesterday}`
    });

    const messages = listResponse.data.messages;
    if (!messages || messages.length === 0) {
        return 'No messages found.';
    }

    const messageId = messages[0].id;

    // Get the email content
    const emailResponse = await gmail.users.messages.get({
        userId: 'me',
        id: messageId
    });

    if (listResponse.data.messages && listResponse.data.messages.length > 0) {
        for (const message of listResponse.data.messages) {
            const messageId = message.id;
            
            // Get the email content
            const emailResponse = await gmail.users.messages.get({
                userId: 'me',
                id: messageId
            });
    
            // Extract the email's content
            const messagePayload = emailResponse.data.payload;
            const headers = messagePayload.headers;
            
            // Find the subject header
            const subjectHeader = headers.find(header => header.name === 'Subject');
            const subject = subjectHeader ? subjectHeader.value : 'No Subject';
    
            // Extract the body content
            let body = '';
            if (messagePayload.parts) {
                // Look for plain text or HTML body
                const part = messagePayload.parts.find(part => part.mimeType === 'text/plain' || part.mimeType === 'text/html');
                if (part && part.body.data) {
                    body = Buffer.from(part.body.data, 'base64').toString();
                }
            } else if (messagePayload.body && messagePayload.body.data) {
                body = Buffer.from(messagePayload.body.data, 'base64').toString();
            }
    
            // Print subject and body of each email
            console.log(`Subject: ${subject}`);
            console.log(`Body: ${body}`);
            console.log('---'); // Divider between emails
        }
    } else {
        console.log('No emails found in the specified criteria.');
    }

    return true;
}

export const microsoftAuth = async (req) => {
    console.log('microsoftAuth is triggered');
    console.log('req: ', req);

    const results = await getAccessTokenMicrosoft(req.code);

    const update_query = `
        UPDATE UserOAuthTokens
        SET token = $1,
        refresh_token = $2,
        token_expires = $3,
        email_address = $4,
        updated_at = now(),
        updated_by = $5
        WHERE user_id = $5
        AND platform_id = 2
        RETURNING *;
    `;

    const update_values = [
        results.accessToken,
        results.refreshToken,
        results.expiryDate,
        results.email,
        req.myId
    ];

    const query = `
        INSERT INTO UserOAuthTokens
        (
            user_id, platform_id, email_address,
            token, refresh_token, token_expires,
            created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $1, $1)
        RETURNING *;
    `;

    const values = [
        req.myId,
        2,
        results.email,
        results.accessToken,
        results.refreshToken,
        results.expiryDate
    ];

    return pool.query(update_query, update_values)
    .then(async r => {
        if (r.rowCount === 0) {

            return pool.query(query, values)
                .then(async results => {
                    if (results.rowCount === 0) {
                        console.error('user not exist');
                        return 404;
                    }
                    else {
                        const oauthToken = await auth.oauthLogin(req.myId).then(u => {
                            u.id = req.myId;
                            return u;
                        });

                        const result = {
                            ...results.rows[0],
                            ...oauthToken
                        }

                        return result;
                    }
                })
                .catch((err) => {
                    console.error('query error: ', err);
                    return 500;
                });
        }
        else {

            const oauthToken = await auth.oauthLogin(req.myId).then(u => {
                u.id = req.myId;
                return u;
            });

            const result = {
                ...r.rows[0],
                ...oauthToken
            }

            return result;
        }
    })
    .catch((err) => {
        console.error('query error: ', err);
        return 500;
    });
}

// 1. Exchange authorization code for access token
async function getAccessTokenMicrosoft(authorizationCode) {
    const tokenUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/token`;

    const data = qs.stringify({
        'client_id': process.env.MICROSOFT_CLIENT_ID,
        'client_secret': process.env.MICROSOFT_CLIENT_SECRET_VALUE,
        'redirect_uri': process.env.MICROSOFT_REDIRECT_URI,
        'code': authorizationCode,
        'scope': 'email Mail.Read User.Read openid',
        'grant_type': 'authorization_code' 
    });

    try {

        const response = await axios.post(tokenUrl, data, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

      const email = await getUserEmailMicrosoft(response.data.access_token);

      const firstEmail = await getTargetedEmailContentMicrosoft(response.data.access_token, "msa@communication.microsoft.com");

    //   console.log('firstEmail: ', firstEmail);

      const result = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiryDate: new Date(Date.now() + response.data.expires_in * 1000),
        email,
        // firstEmail
      }

      return result;
    } catch (error) {
      console.error('Error fetching access token:', error);
      throw new Error('Could not retrieve access token');
    }
  }

// 2. Use access token to get user’s email address
async function getUserEmailMicrosoft(accessToken) {
    const graphUrl = 'https://graph.microsoft.com/v1.0/me';

    try {
        const response = await axios.get(graphUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        return response.data.mail || response.data.userPrincipalName;
    } catch (error) {
        console.error('Error fetching user email:', error);
        throw new Error('Could not retrieve user email');
    }
}

function getTimeStrings() {
    const now = new Date();

    // Set the current time to yesterday at 00:00 UTC
    const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0));
    
    // Set the time to the day before yesterday at 00:00 UTC
    const dayBeforeYesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2, 0, 0, 0));

    // Format the dates as yyyy-mm-ddThh:mm:ssZ
    const formatDate = (date) => date.toISOString().split('.')[0] + 'Z';

    return {
        yesterday: formatDate(yesterday),
        dayBeforeYesterday: formatDate(dayBeforeYesterday),
    };
}

// 3. Get the first email from the mailbox
async function getTargetedEmailContentMicrosoft(accessToken, targetedEmailAddress) {

    const { yesterday, dayBeforeYesterday } = getTimeStrings();

    const graphUrl = `https://graph.microsoft.com/v1.0/me/mailfolders/inbox/messages?$select=subject,from,receivedDateTime,uniqueBody&$filter=from/emailAddress/address eq '${
        targetedEmailAddress
    }' and receivedDateTime ge ${dayBeforeYesterday} and receivedDateTime le ${yesterday}`;

    try {
        const response = await axios.get(graphUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const messages = response.data.value;

        if (!messages || messages.length === 0) {
            return 'No messages found.';
        }

        const messageId = messages[0].id;

        const emailResponse = await axios.get(`${graphUrl}/${messageId}`, {

            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const message = emailResponse.data;

        const subject = message.subject;

        let body = '';

        if (message.body.contentType === 'text') {
            body = message.body.content;
        } else if (message.body.contentType === 'html') {
            body = message.body.content;
        }

        return {
            subject,
            body
        };
    } catch (error) {
        console.error('Error fetching email content:', error);
        throw new Error('Could not retrieve email content');
    }
}

export const insertTeamMember = async (userId, teamId) => {
    console.log('insertTeamMember is triggered');
    console.log('userId: ', userId);
    console.log('teamId: ', teamId);

    const query = `
        INSERT INTO UserTeamMembers
        (team_id, role_id, user_id, created_at, updated_at, created_by, updated_by)
        VALUES
        ($1, 2, $2, now(), now(), $2, $2)
        RETURNING id;
    `;

    const values = [teamId, userId];

    return pool.query(query, values)
    .then(r => {
        if (!r.rowCount) {
            return 404;
        }

        return r.rows[0].id;
    })
    .catch(err => {
        console.error('query failed, error: ', err);
        return 500;
    })
}

export const resendRegEmail = req => {
    console.log('resendRegEmail is triggered');
    console.log('req: ', req);

    const random_url = Math.floor((Math.random() * 9 + 1) * 100000).toString() + new Date().getTime();

    const update_query = `
        UPDATE EmailVerifyLinks
        SET deleted = true,
        updated_at = now(),
        updated_by = 0
        WHERE email = $1
        AND used = false
        AND deleted = false;
    `;

    const update_values = [req.email];

    const user_query = `
        SELECT id
        FROM Users
        WHERE email = $1
        AND email_verified = false
        AND deleted = false;
    `;

    const user_values = [req.email];

    const verify_query = `
        INSERT INTO EmailVerifyLinks
        (email, url, user_id, valid_before, created_at)
        VALUES
        ($1, $2, $3, now() + interval '5 minutes', now())
        RETURNING created_at;
    `;

    return pool.query(update_query, update_values)
    .then(() => {
        return pool.query(user_query, user_values)
        .then(u => {
            if (!u.rowCount) {
                throw 404;
            }

            const verify_values = [
                req.email,
                random_url,
                u.rows[0].id
            ];
            return pool.query(verify_query, verify_values)
            .then(async () => {
                const url = await getUnsubscribeUrlByUserId(userId);
                verificationEmailSender(req.email, random_url, url, true);
                return {
                    success: true
                }
            })
            .catch(err => {
                console.error('verify_query failed, error: ', err);
                throw typeof err == 'number' ? err : 500;
            })
        })
        .catch(err => {
            console.error('user_query failed, error: ', err);
            throw typeof err == 'number' ? err : 500;
        })
    })
    .catch(err => {
        console.error('update_query failed, error: ', err);
        throw typeof err == 'number' ? err : 500;
    })
}

export const getUserByEmail = value => {
    const query = `
        SELECT * 
        FROM Users 
        WHERE LOWER(email) = LOWER($1) 
        AND email_verified = true
        AND deleted = false;
    `;

    const values = [value];

    return pool.query(query, values)
        .then(results => {
            if (results.rowCount === 0) {
                console.error('user not exist');
                return 404;
            }
            else {
                return results.rows[0];
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return 500;
        });
};

export const getEmailByUserId = userId => {
    console.log('getEmailByuserId is triggered');
    console.log('userId: ', userId);

    const query = `
        SELECT email
        FROM Users
        WHERE deleted = false
        AND email_verified = true
        AND id = $1;
    `;

    const values = [userId];

    return pool.query(query, values)
    .then(r => {
        if (!r.rowCount) {
            throw 404;
        }

        return r.rows[0].email;
    })
    .catch(err => {
        console.error('query failed, error: ', err);
        throw typeof err == 'number' ? err : 500;
    })
}

export const getUserAccountInfoById = value => {
    const query = `
        SELECT id, full_name, email, photo_url, role_id
        FROM Users 
        WHERE id = $1 
        AND deleted = false;
    `;

    const values = [value];

    return pool.query(query, values)
        .then(results => {
            if (results.rowCount === 0) {
                console.error('user not exist');
                return 404;
            }
            else {
                return snake2Camel(results.rows[0]);
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return 500;
        });
}

export const updateUserAccountInfoById = async req => {
    console.log('updateUserAccountInfoById is triggered');
    console.log('req: ', req);
    const query = `
        UPDATE Users 
        SET 
            full_name = $1,
            updated_at = now(),
            updated_by = $2
        WHERE id = $2
        AND deleted = false
        RETURNING full_name, email, photo_url;
    `;

    const values = [
        req.fullName,
        req.myId
    ];

    return pool.query(query, values)
        .then(results => {
            
            if (results.rowCount === 0) {
                console.error('user not exist');
                return 404;
            }
            else {
                return results.rows[0];
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return 500;
        });
}

export const verifyUserAccountEmailForRegistrationByVerificaitonUrl = async req => {
    console.log('verifyUserAccountEmailForRegistrationByVerificaitonUrl is triggered');
    console.log('req: ', req);

    const check_query = `
        SELECT count(*)::INT
        FROM Users 
        WHERE email = $1
        AND email_verified = true
        AND deleted = false;
    `;

    const query = `
        SELECT evl.user_id, u.email_verified, u.email, u.id
        FROM EmailVerifyLinks evl, Users u
        WHERE evl.user_id = u.id
        AND evl.email = u.email
        AND u.email_verified = false
        AND evl.url = $1
        AND evl.used = false
        AND evl.deleted = false
        AND evl.valid_before > now();
    `;

    const update_link_query = `
        UPDATE EmailVerifyLinks
        SET used = true,
        updated_at = now()
        WHERE url = $1
        AND used = false
        AND deleted = false;
    `;

    const update_user_query = `
        UPDATE Users
        SET email_verified = true,
        updated_at = now(),
        updated_by = $1
        WHERE id = $1
        AND deleted = false;
    `;

    const values = [
        req.url
    ];

    const user = await pool.query(query, values)
    .then(u => {
        if (!u.rowCount) {
            throw 404;
        }

        return u.rows[0];
    })
    .catch(err => {
        console.error('user_query failed, error: ', err);
        throw typeof err == 'number' ? err : 500;
    });

    const check_values = [user.email];

    await pool.query(check_query, check_values)
    .then(c => {
        if (c.rowCount && c.rows[0].count > 0) {
            throw 403;
        }
    })
    .catch(err => {
        console.error('check_query failed, error: ', err);
        throw typeof err == 'number' ? err : 500;
    });

    await pool.query(update_link_query, values);

    const update_user_values = [user.id];

    return pool.query(update_user_query, update_user_values)
    .then(() => {
        return auth.oauthLogin(user.id).then(u => {
            u.id = user.id;
            return u;
        });
    })
    .catch(err => {
        console.error('update_user_query failed, error: ', err);
        throw typeof err == 'number' ? err : 500;
    });
}

export const updateUserAccountEmailByVerificationUrl = async req => {
    console.log('updateUserAccountEmailByVerificationUrl is triggered');
    console.log('req: ', req);

    const query = `
        SELECT new_email, user_id
        FROM EmailVerifyLinks evl, Users u
        WHERE evl.user_id = u.id
        AND evl.email = u.email
        AND evl.url = $1
        AND evl.used = false
        AND evl.user_id = $2
        AND evl.deleted = false
        AND evl.valid_before > now();
    `;

    const values = [
        req.url,
        req.myId
    ];

    const check_email_query = `
        SELECT 1
        FROM Users
        WHERE id != $1
        AND deleted = false
        AND email = $2
        AND email_verified = true;
    `;

    return pool.query(query, values)
        .then(results => {
            
            if (results.rowCount === 0) {
                console.error('user or verify link not exist');
                return 404;
            }
            else {
                req.email = results.rows[0].new_email;
                const check_email_values = [req.myId, req.email];
                return pool.query(check_email_query, check_email_values)
                .then(c => {
                    if (c.rowCount) {
                        console.log('Email has been used, abort.');
                        throw 403;
                    }

                    return updateUserAccountEmailById(req);
                })
                .catch((err) => {
                    console.error('check_email_query error: ', err);
                    return typeof err == 'number' ? err : 500;
                });
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return typeof err == 'number' ? err : 500;
        });
}

export const updateUserAccountEmailById = async req => {
    console.log('updateUserAccountEmailById is triggered');
    console.log('req: ', req);
    const query = `
        UPDATE Users 
        SET 
            email = $1,
            updated_at = now(),
            updated_by = $2
        WHERE id = $2
        AND deleted = false
        RETURNING full_name, email, photo_url;
    `;

    const values = [
        req.email,
        req.myId
    ];

    const disable_unsubscription_url_query = `
        UPDATE UnsubscriptionUniqueUrls 
        SET disabled = true, 
        updated_at = now(), 
        updated_by = $1 
        WHERE disabled = false 
        AND used = false 
        AND user_id = $1
        AND user_type = 2;
    `;

    const unsubscription_url_query = `
        INSERT INTO UnsubscriptionUniqueUrls 
        (email, url, user_id, created_by, updated_by) 
        VALUES 
        ($1, $2, $3, $3, $3);
    `;

    const disable_unsubscription_url_values = [req.myId];

    const unsubscription_url_values = [req.email, new Date().getTime().toString() + uuidv1().replace(/-/g, ''), req.myId];

    return pool.query(query, values)
        .then(async results => {
            
            if (results.rowCount === 0) {
                console.error('user not exist');
                return 404;
            }
            else {
                await pool.query(disable_unsubscription_url_query, disable_unsubscription_url_values);
                await pool.query(unsubscription_url_query, unsubscription_url_values);
                
                return results.rows[0];
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return 500;
        });
}

export const unsubscribeAsUser = (req) => {
    console.log('unsubscribeAsUser is triggered');
    const { url, reasonId = 0, content = '' } = req;
    console.log('url: ', url);
    console.log('reasonId: ', reasonId);
    console.log('content: ', content);

    const query = `
        UPDATE UnsubscriptionUniqueUrls
        SET used = true,
        reason_id = $2,
        content = $3,
        updated_at = now()
        WHERE url = $1
        AND used = false
        AND disabled = false
        RETURNING id, user_id;
    `;

    const values = [url, reasonId, content];

    const clear_query = `
        UPDATE UnsubscriptionUniqueUrls
        SET disabled = true,
        updated_at = now(),
        updated_by = 0
        WHERE user_id = $1
        AND (
            used = false
            OR disabled = false
        );
    `;

    return pool.query(query, values).then(async r => {
        if (r.rowCount) {
            const clear_values = [r.rows[0].user_id];
            await pool.query(clear_query, clear_values);

            return {
                success: true,
                id: r.rows[0].id
            }
        }
        else {
            return 404;
        }
    })
    .catch((err) => {
        console.error('query failed, error: ', err);
        return 500;
    })
}

export const getUnsubscribeUrlByUrl = (req) => {
    console.log('getUnsubscribeUrlByUrl is triggered');
    const { url } = req;
    console.log('url: ', url);

    const query = `
        SELECT u.email
        FROM UnsubscriptionUniqueUrls uuu, Users u
        WHERE uuu.user_id = u.id
        AND uuu.used = false
        AND uuu.disabled = false
        AND uuu.url = $1
        AND u.deleted = false;
    `;

    const values = [url];

    return pool.query(query, values).then(r => {
        if (r.rowCount) {
            return {
                success: true,
                email: r.rows[0].email
            }
        }
        else {
            return 404;
        }
    })
    .catch((err) => {
        console.error('query failed, error: ', err);
        return 500;
    })
}

export const updateUserPhotoById = async req => {
    console.log('updateUserPhotoById is triggered');
    console.log('req: ', req);

    // Resize the uploaded photo
    const photoResized = await photoResize(req.buffer)
    .catch(err => {
        console.error('photoResize failed, error: ', err);
        throw typeof err == 'number' ? err : 500;
    });

    const photoUrl = `photos/${req.myId}/240-${new Date().getTime()}.jpeg`;

    // Upload resized photos
    await uploadBuffer(photoResized['240'], photoUrl, photoResized['240'].length)
    .catch(err => {
        console.error('uploadBuffer failed, error: ', err);
        throw typeof err == 'number' ? err : 500;
    });

    const query = `
        UPDATE Users 
        SET 
            photo_url = $1,
            updated_at = now(),
            updated_by = $2
        WHERE id = $3
        AND deleted = false
        RETURNING full_name, email, photo_url;
    `;

    const values = [
        photoUrl,
        req.myId,
        req.myId
    ];

    return pool.query(query, values)
        .then(results => {
            
            if (results.rowCount === 0) {
                console.error('user not exist');
                return 404;
            }
            else {
                return results.rows[0];
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return 500;
        });
}

function photoResize(buffer) {
    const promises = [];
    const buffers = {
        '240': null,
        '110': null,
        '50': null,
        '42': null,
        '32': null,
        '24': null
    };
    return new Promise((resolve, reject) => {
        
        graphicsMagick(buffer).size((err, size) => {
            if (!err) {
                if (size.width >= size.height) {
                    promises.push(
                        new Promise((res, rej) => {
                            graphicsMagick(buffer).resize(null, 240).gravity('Center').crop(240, 240, 0, 0).background('white').flatten().setFormat('jpeg').toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error: ', err);
                                    rej();
                                }
                                buffers['240'] = buffer;
                                res();
                            })
                        })
                    )
                    promises.push(
                        new Promise((res, rej) => {
                            graphicsMagick(buffer).resize(null, 110).gravity('Center').crop(110, 110, 0, 0).background('white').flatten().setFormat('jpeg').toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error: ', err);
                                    rej();
                                }
                                buffers['110'] = buffer;
                                res();
                            })
                        })
                    )
                    promises.push(
                        new Promise((res, rej) => {
                            graphicsMagick(buffer).resize(null, 50).gravity('Center').crop(50, 50, 0, 0).background('white').flatten().setFormat('jpeg').toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error: ', err);
                                    rej();
                                }
                                buffers['50'] = buffer;
                                res();
                            })
                        })
                    )
                    promises.push(
                        new Promise((res, rej) => {
                            graphicsMagick(buffer).resize(null, 42).gravity('Center').crop(42, 42, 0, 0).background('white').flatten().setFormat('jpeg').toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error: ', err);
                                    rej();
                                }
                                buffers['42'] = buffer;
                                res();
                            })
                        })
                    )
                    promises.push(
                        new Promise((res, rej) => {
                            graphicsMagick(buffer).resize(null, 32).gravity('Center').crop(32, 32, 0, 0).background('white').flatten().setFormat('jpeg').toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error: ', err);
                                    rej();
                                }
                                buffers['32'] = buffer;
                                res();
                            })
                        })
                    )
                    promises.push(
                        new Promise((res, rej) => {
                            graphicsMagick(buffer).resize(null, 24).gravity('Center').crop(24, 24, 0, 0).background('white').flatten().setFormat('jpeg').toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error: ', err);
                                    rej();
                                }
                                buffers['24'] = buffer;
                                res();
                            })
                        })
                    )
                }
                else {
                    promises.push(
                        new Promise((res, rej) => {
                            graphicsMagick(buffer).resize(240, null).gravity('Center').crop(240, 240, 0, 0).background('white').flatten().setFormat('jpeg').toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error: ', err);
                                    rej();
                                }
                                buffers['240'] = buffer;
                                res();
                            })
                        })
                    )
                    promises.push(
                        new Promise((res, rej) => {
                            graphicsMagick(buffer).resize(110, null).gravity('Center').crop(110, 110, 0, 0).background('white').flatten().setFormat('jpeg').toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error: ', err);
                                    rej();
                                }
                                buffers['110'] = buffer;
                                res();
                            })
                        })
                    )
                    promises.push(
                        new Promise((res, rej) => {
                            graphicsMagick(buffer).resize(50, null).gravity('Center').crop(50, 50, 0, 0).background('white').flatten().setFormat('jpeg').toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error: ', err);
                                    rej();
                                }
                                buffers['50'] = buffer;
                                res();
                            })
                        })
                    )
                    promises.push(
                        new Promise((res, rej) => {
                            graphicsMagick(buffer).resize(42, null).gravity('Center').crop(42, 42, 0, 0).background('white').flatten().setFormat('jpeg').toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error: ', err);
                                    rej();
                                }
                                buffers['42'] = buffer;
                                res();
                            })
                        })
                    )
                    promises.push(
                        new Promise((res, rej) => {
                            graphicsMagick(buffer).resize(32, null).gravity('Center').crop(32, 32, 0, 0).background('white').flatten().setFormat('jpeg').toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error: ', err);
                                    rej();
                                }
                                buffers['32'] = buffer;
                                res();
                            })
                        })
                    )
                    promises.push(
                        new Promise((res, rej) => {
                            graphicsMagick(buffer).resize(24, null).gravity('Center').crop(24, 24, 0, 0).background('white').flatten().setFormat('jpeg').toBuffer((err, buffer) => {
                                if (err) {
                                    console.error('Error: ', err);
                                    rej();
                                }
                                buffers['24'] = buffer;
                                res();
                            })
                        })
                    )
                }
                Promise.all(promises).then(() => {
                    resolve(buffers);
                })
                .catch(err => {
                    console.error('Error: ', err);
                    reject();
                })
            }
            else {
                reject();
            }
        })
        
    });
}

export const getUserProfileById = async req => {
    console.log('getUserProfileById is triggered');
    console.log('req: ', req);
    const query = `
        SELECT 
            u.id,
            u.current_role_level_id,
            u.current_job_title,
            u.desired_annual_salary,
            u.desired_country_id,
            u.resume_url,
            u.linkedin_url
        FROM UserProfiles u
        WHERE u.user_id = $1
        AND u.deleted = false;
    `;

    const values = [req];

    return pool.query(query, values)
        .then(results => {
            
            if (results.rowCount === 0) {
                return 204;
            }
            else {
                return results.rows[0];
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return 500;
        });
}

export const updateUserProfileById = async req => {
    console.log('updateUserProfileById is triggered');
    console.log('req: ', req);

    const query = `
        UPDATE UserProfiles 
        SET 
            current_role_level_id = $1,
            current_job_title = $2,
            desired_annual_salary = $3,
            desired_country_id = $4,
            linkedin_url = $5,
            ${
                req.deleteResume ?
                'resume_url = null, '
                :
                ''
            }
            updated_at = now(),
            updated_by = $6
        WHERE user_id = $7
        AND deleted = false
        RETURNING *;
    `;

    const insert_query = `
        INSERT INTO UserProfiles
        (user_id, current_role_level_id, current_job_title, desired_annual_salary, desired_country_id, linkedin_url, created_at, updated_at, created_by, updated_by)
        VALUES
        ($7, $1, $2, $3, $4, $5, now(), now(), $6, $6)
        RETURNING *;
    `;

    const values = [
        req.currentRoleLevelId,
        req.currentJobTitle,
        req.desiredAnnualSalary,
        req.desiredCountryId,
        req.linkedinUrl,
        req.myId,
        req.userId
    ];

    return pool.query(query, values)
        .then(results => {
            
            if (results.rowCount === 0) {
                return pool.query(insert_query, values).then((res) => {
                    return res.rows[0];
                })
                .catch(err => {
                    console.error('insert_query failed, error: ', err);
                    return 500;
                })
            }
            else {
                return results.rows[0];
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return 500;
        });
}

export const updateUserProfileResumeById = async req => {
    console.log('updateUserProfileResumeById is triggered');
    console.log('req: ', req);

    const resumeUrl = `resumes/${req.myId}/profileresume-${new Date().getTime()}.${req.originalname.replaceAll(' ', '_').split('.').pop()}`;

    // Upload resume
    await uploadBuffer(req.buffer, resumeUrl, req.buffer.length);

    const query = `
        UPDATE UserProfiles 
        SET 
            resume_url = $1,
            updated_at = now(),
            updated_by = $2
        WHERE user_id = $3
        AND deleted = false;
    `;

    const values = [
        resumeUrl,
        req.myId,
        req.myId
    ];

    return pool.query(query, values)
        .then(results => {
            
            if (results.rowCount === 0) {
                return 204;
            }
            else {
                return true;
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return 500;
        });
}

export const getNotificationList = id => {
    console.log('getNotificationList is triggered');
    console.log('id: ', id);
    const query = `
        SELECT 
            id,
            title,
            content,
            read,
            type_id,
            item_id,
            created_at
        FROM Notifications
        WHERE user_id = $1
        AND deleted = false
        ORDER BY created_at DESC;
    `;

    const values = [id];

    return pool.query(query, values)
        .then(results => {
            
            if (results.rowCount === 0) {
                return [];
            }
            else {
                return results.rows;
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return [];
        });
}

export const readNotificationById = req => {
    console.log('readNotificationById is triggered');
    console.log('req: ', req);
    const query = `
        UPDATE Notifications
        SET 
            read = true,
            updated_at = now(),
            updated_by = $1
        WHERE id = $2
        AND deleted = false
        RETURNING id;
    `;

    const values = [req.myId, req.notificationId];

    return pool.query(query, values)
        .then(results => {
            
            if (results.rowCount === 0) {
                return false;
            }
            else {
                return true;
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return false;
        });
}

export const deleteNotificationById = req => {
    console.log('deleteNotificationById is triggered');
    console.log('req: ', req);
    const query = `
        UPDATE Notifications
        SET 
            deleted = true,
            updated_at = now(),
            updated_by = $1
        WHERE id = $2
        AND deleted = false
        RETURNING id;
    `;

    const values = [req.myId, req.notificationId];

    return pool.query(query, values)
        .then(results => {
            
            if (results.rowCount === 0) {
                return false;
            }
            else {
                return true;
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return false;
        });
}

export const resendEmailVerificationLink = res => {
    console.log('resendEmailVerificationLink is triggered');
    const uid = res.myId;
    const newEmail = res.email;

    const check_email_query = `
        SELECT 1
        FROM Users
        WHERE id != $1
        AND deleted = false
        AND email = $2
        AND email_verified = true;
    `;

    const check_email_values = [uid, newEmail];

    const user_query = `
        SELECT email
        FROM Users
        WHERE id = $1
        AND deleted = false;
    `;

    const user_values = [uid];

    return pool.query(check_email_query, check_email_values)
    .then(c => {
        if (c.rowCount) {
            console.log('Email has been used, abort.');
            throw 403;
        }

        return pool.query(user_query, user_values).then(async u => {
    
            if (u.rowCount) {
                const email = u.rows[0].email;
    
                const disable_old_link_query = `
                    UPDATE EmailVerifyLinks
                    SET valid_before = now()
                    WHERE user_id = $1
                    AND email = $2
                    AND valid_before > now()
                    AND used = false;
                `;
    
                const disable_old_link_values = [uid, email];
    
                await pool.query(disable_old_link_query, disable_old_link_values)
                .catch((err) => {
                    console.error('disable_old_link_query failed, error: ', err);
                })
    
                const verification_query = `
                    INSERT INTO EmailVerifyLinks
                    (email, url, user_id, new_email, valid_before, created_at)
                    VALUES
                    ($1, $2, $3, $4, now() + interval '5 minutes', now())
                    RETURNING created_at;
                `;
    
                const random_url = Math.floor((Math.random() * 9 + 1) * 100000).toString() + new Date().getTime();
                const verification_values = [email, random_url, uid, newEmail];
                return pool.query(verification_query, verification_values)
                .then(async () => {
                    const url = await getUnsubscribeUrlByUserId(uid);
                    verificationEmailSender(newEmail, random_url, url);
                    return {
                        success: true,
                    }
                })
                .catch((err) => {
                    console.error('verification_query failed, error: ', err);
                    return 500;
                })
            }
    
        })
        .catch((err) => {
            console.error('user_query failed, error: ', err);
            return 500;
        })
    })
    .catch(err => {
        console.error('check_email_query failed, error: ', err);
        throw typeof err == 'number' ? err : 500;
    })
}

export const getUnsubscribeUrlByUserId = (userId) => {
    console.log('getUnsubscribeUrlByUserId is triggered');
    console.log('userId: ', userId);

    const unsubscribe_unique_url_query = `
        SELECT uuu.url 
        FROM UnsubscriptionUniqueUrls uuu, Users u 
        WHERE uuu.email = u.email 
        AND uuu.user_id = $1 
        AND uuu.user_id = u.id 
        AND uuu.used = false 
        AND uuu.disabled = false;
    `;

    const unsubscribe_unique_url_values = [
        userId
    ];

    let unsubscribeUrl = '';

    return pool.query(unsubscribe_unique_url_query, unsubscribe_unique_url_values).then(uuu => {
        if (uuu.rowCount !== 0) {
            unsubscribeUrl = uuu.rows[0].url;
        }
        return process.env.FRONTEND_URL + '/unsubscribe/' + unsubscribeUrl;
    })
    .catch((err) => {
        console.error('unsubscribe_unique_url_query failed, error: ', err);
        return 500;
    });
}

export const checkPasswordByUserId = (uid) => {
    console.log('checkPasswordByUserId is triggered');
    console.log('uid: ', uid);

    const query = `
        SELECT password
        FROM Users
        WHERE id = $1
        AND deleted = false;
    `;

    const values = [uid];

    return pool.query(query, values)
    .then(r => {
        if (!r.rowCount) {
            throw 404;
        }

        return {
            valid: r.rows[0].password != null
        };
    })
    .catch(err => {
        console.error('query failed, error: ', err);
        throw typeof err == 'number' ? err : 500;
    });
}

export const updatePasswordByUserId = (password, uid) => {
    console.log('updatePasswordByUserId is triggered');
    // 修改密码之前把密码转码为JWT形式
    password = crypto.saltHashPassword(password).toString();
    console.log('password: ', password);
    console.log('uid: ', uid);
    const query = `
        UPDATE users
        SET password = $1,
        updated_at = now(),
        updated_by = $2
        WHERE id = $2
        AND deleted = false
        RETURNING *;
    `;

    const values = [password, uid];

    return pool.query(query, values)
        .then(results => {
            console.log('Updated User ' + uid + ' Password to: ' + password);
            console.log('results.rows: ', results.rows);
            return { message: 'Update password success' };
        })
        .catch((err) => {
            console.error('query error: ', err)
            return 500;
        });
};

export const confirmPassword = (password, username) => {
    console.log('confirmPassword is triggered');
    console.log('password: ', password);
    console.log('username: ', username);
    const userpassword = getUserByUsername(username);
    return userpassword.then((res) => {
        if (res) {
            console.log('got username & password: ', res);
            if (!res.password) {
                console.log('user has no password, skip verifying')
                return 1;
            }
            else {
                const b_validated = crypto.validatePassword(password, res.password);
                console.log('b_validated: ', b_validated);
                if (b_validated) {
                    return 1;
                } else { return 403 }
            }
        } else { return 403 }
    })
};

export const sendResetPasswordEmail = email => {
    console.log('sendResetPasswordEmail is triggered');
    console.log('email: ', email);

    const check_query = `
        SELECT u.id, u.full_name, uuu.url FROM 
        Users u
        LEFT JOIN 
        UnsubscriptionUniqueUrls uuu 
        ON uuu.user_id = u.id 
        AND uuu.email = $1 
        AND uuu.used = false 
        AND uuu.disabled = false
        WHERE u.email = $1
        AND deleted = false
        AND email_verified = true;
    `;

    const check_values = [email];

    const reset_query = `
        INSERT INTO ResetPasswordUrls
        (user_id, url, created_by, updated_by) 
        VALUES
        ($1, $2, $1, $1)
        RETURNING *;
    `;

    let uuid = uuidv1();
    uuid = uuid.replace(/-/g, '');

    return pool.query(check_query, check_values).then(c => {
        if (c.rowCount !== 0) {
            const reset_values = [
                c.rows[0].id, uuid
            ];
            let unsubscribe_url = c.rows[0].url;

            if (!unsubscribe_url) {
                unsubscribe_url = 'mailto:contact@elasticdash.com';
            }

            return pool.query(reset_query, reset_values).then(async r => {

                const html = resetPassswordEmailContent(r.rows[0].url, unsubscribe_url);

                const subject = 'Important: reset your password on ElasticDash';
    
                generalEmailSender(
                    email, subject, html
                );

                return true;
            })
            .catch(err => {
                console.error('reset_query failed, error: ', err);
                let errCode = 500;
                if (typeof err === 'number') {
                    errCode = err;
                }
                throw errCode;
            });
        }
        else {
            return 404;
        }
    })
    .catch(err => {
        console.error('check_query failed, error: ', err);
        let errCode = 500;
        if (typeof err === 'number') {
            errCode = err;
        }
        throw errCode;
    });
};

export const resetPassword = (uuid, password) => {
    console.log('resetPassword is triggered');
    console.log('uuid: ', uuid);
    console.log('password: ', password);
    const update_query = `
        UPDATE ResetPasswordUrls 
        SET valid = false 
        WHERE url = $1
        AND valid = true
        RETURNING *;
    `;

    const update_values = [uuid];

    return pool.query(update_query, update_values).then(u => {
        console.log('u.rows: ', u.rows);
        if (u.rowCount > 0) {
            const user_id = u.rows[0].user_id;
            return updatePasswordByUserId(password, user_id)
            .then(r => {
                return r;
            })
            .catch((err) => {
                console.error('updatePasswordByUserId failed, error: ', err);
                return 500;
            })
        }
        else {
            console.error('user not found.');
            return 404;
        }
    })
    .catch((err) => {
        console.error('update_query failed, error: ', err);
        return 500;
    })
};

export const updateLastActive = (id, request) => {
    // console.log('updateLastActive is triggered');
    // console.log('id: ', id);
    const query = `
        UPDATE Users SET 
        last_active = $1, 
        logged_in = true, 
        updated_by = id, 
        updated_at = $1
        WHERE id = $2;
    `;

    const values = [new Date(), id];

    return pool.query(query, values).then(() => {

        return true;
    })
        .catch((err) => {
            console.error('query failed, error: ', err);
            return 500;
        })
};

export const getUserByUsername = value => {
    const query = `
        SELECT * 
        FROM Users 
        WHERE username = $1 
        AND deleted = false;
    `;

    const values = [value];

    return pool.query(query, values)
        .then(results => {
            if (results.rowCount === 0) {
                console.error('user not exist');
                return 404;
            }
            else {
                results.rows[0].alternative_id = null;
                return results.rows[0];
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            return 500;
        });
};

// Onboarding START

// 导出一个异步函数，用于获取用户引导流程
export const getOnboardingProcess = async (myId) => {
    // 打印函数被触发
    console.log('getOnboardingProcess is triggered');
    // 打印传入的参数
    console.log('myId: ', myId);

    /***
     * The onboarding process contains 2 steps:
     * 
     * 1. Create a valid password
     * 2. Check the existing API template
     */

    const pw_query = `
        SELECT password
        FROM Users
        WHERE id = $1
        AND deleted = false;
    `;

    const pw_values = [myId];

    const pwValid = await pool.query(pw_query, pw_values)
        .then(u => {
            if (u.rowCount === 0) {
                console.error('user not exist');
                throw 404;
            }
            else {
                const password = u.rows[0].password;
                if (!password) {
                    return false;
                }
                else {
                    return true;
                }
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            throw typeof err === 'number' ? err : 500;
        });
    
    if (!pwValid) {
        return {
            step: 0,
            message: 'Please create a valid password.'
        }
    }

    const query = `
        SELECT step
        FROM UserOnboardingProcesses
        WHERE user_id = $1
        AND deleted = false;
    `;

    const values = [myId];

    const step = await pool.query(query, values)
        .then(u => {
            if (u.rowCount === 0) {
                return 1;
            }
            else {
                return u.rows[0].step ? u.rows[0].step : 1;
            }
        })
        .catch((err) => {
            console.error('query error: ', err);
            throw typeof err === 'number' ? err : 500;
        });

    return {
        step: step
    }
}

export const updateOnboardingProcess = async (myId, step) => {
    console.log('updateOnboardingProcess is triggered');
    console.log('myId: ', myId);
    console.log('step: ', step);

    const query = `
        UPDATE UserOnboardingProcesses SET
        step = $1,
        updated_by = $2,
        updated_at = $3
        WHERE user_id = $4
        AND deleted = false
        RETURNING id;
    `;

    const insert_query = `
        INSERT INTO UserOnboardingProcesses
        (user_id, step, created_at, created_by)
        VALUES
        ($2, $1, $3, $4)
        RETURNING id;
    `;

    const values = [
        step,
        myId,
        new Date(),
        myId
    ];

    return pool.query(query, values).then((r) => {
        if (r.rowCount === 0) {
            return pool.query(insert_query, values).then((res) => {
                return res.rows[0];
            })
            .catch(err => {
                console.error('insert_query failed, error: ', err);
                return 500;
            })
        }
        else {
            return r.rows[0];
        }
    })
    .catch((err) => {
        console.error('query error: ', err);
        return 500;
    });
}

// Onboarding END
