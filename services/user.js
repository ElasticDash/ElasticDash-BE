// DatabaseConnections APIs
import * as dbConnDAO from '../controller/user/databaseConnectionDAO.js';
import * as user from '../controller/user/user';
import * as auth from '../controller/auth/auth';
import * as project from '../controller/user/project.js';
import * as feedbackDAO from '../controller/chat/feedbackDAO.js';
import express from 'express';
import multer from 'multer';
import { io } from '../index';
import { validateBodyWithKeys, generalApiResponseSender, generalApiErrorHandler } from '../controller/general/tools';
const router = express.Router();

// POST /user/feedback/withdraw/:id - mark feedback as withdrawn
router.post('/feedback/withdraw/:id', (request, response) => {
    console.log('api: POST /user/feedback/withdraw/:id');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const feedbackId = parseInt(request.params.id, 10);
            if (isNaN(feedbackId)) {
                return generalApiErrorHandler(response, { status: 400, message: 'Invalid feedback id' });
            }
            // Only allow if feedback belongs to user
            import('../controller/chat/feedbackDAO.js').then(feedbackDAO => {
                feedbackDAO.getFeedbackDetail(feedbackId)
                    .then(res => {
                        if (!res || res.feedback.user_id !== myId) {
                            return generalApiErrorHandler(response, { status: 403, message: 'Forbidden' });
                        }
                        // Update status to 'withdrawn'
                        feedbackDAO.updateFeedbackStatus(feedbackId, 'withdrawn')
                            .then(result => {
                                generalApiResponseSender(response, { success: true });
                            })
                            .catch(err => {
                                console.error('Error status: ', err);
                                generalApiErrorHandler(response, err);
                            });
                    })
                    .catch(err => {
                        console.error('Error status: ', err);
                        generalApiErrorHandler(response, err);
                    });
            });
        } else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    }).catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// GET /user/feedbacks/all - list all feedbacks for current user
router.get('/feedbacks/all', (request, response) => {
    console.log('api: GET /user/feedbacks/all');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            feedbackDAO.getFeedbacksByUser(myId)
                .then(res => {
                    generalApiResponseSender(response, res);
                })
                .catch(err => {
                    console.error('Error status: ', err);
                    generalApiErrorHandler(response, err);
                });
        } else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    }).catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// GET /user/feedbacks/unhelpful - list all unhelpful feedbacks for current user
router.get('/feedbacks/unhelpful', (request, response) => {
    console.log('api: GET /user/feedbacks/unhelpful');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            feedbackDAO.getFeedbacksByUser(myId, false)
                .then(res => {
                    generalApiResponseSender(response, res);
                })
                .catch(err => {
                    console.error('Error status: ', err);
                    generalApiErrorHandler(response, err);
                });
        } else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    }).catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// POST /user/feedbacks/post - create feedback as current user
router.post('/feedbacks/post', (request, response) => {
    console.log('api: POST /user/feedbacks/post');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const body = request.body;
            console.log('body: ', body);
            const valid = validateBodyWithKeys(body, ['messageId', 'isHelpful'], false);
            if (!valid) {
                return generalApiErrorHandler(response, { status: 400, message: 'Invalid request body' });
            }
            if (!body.isHelpful && (!body.description || !body.expectedResponse)) {
                return generalApiErrorHandler(response, { status: 400, message: 'Description and expected response are required for unhelpful feedback' });
            }
            const input = {
                messageId: body.messageId,
                conversationId: body.conversationId || null,
                userId: myId,
                feedbackType: body.feedbackType || 'general',
                isHelpful: body.isHelpful,
                description: body.description || null,
                expectedResponse: body.expectedResponse || null,
            }
            
            feedbackDAO.upsertFeedback(input)
                .then(res => {
                    generalApiResponseSender(response, res);
                })
                .catch(err => {
                    console.error('Error status: ', err);
                    generalApiErrorHandler(response, err);
                });
        } else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    }).catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// GET /user/feedback/detail/:id - get feedback detail (relevant message and 3 before/after)
router.get('/feedback/detail/:id', (request, response) => {
    console.log('api: GET /user/feedback/detail/:id');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const feedbackId = parseInt(request.params.id, 10);
            if (isNaN(feedbackId)) {
                return generalApiErrorHandler(response, { status: 400, message: 'Invalid feedback id' });
            }
            feedbackDAO.getFeedbackDetail(feedbackId)
                .then(res => {
                    // Only allow access if the feedback belongs to the user
                    if (!res || res.feedback.user_id !== myId) {
                        return generalApiErrorHandler(response, { status: 403, message: 'Forbidden' });
                    }
                    generalApiResponseSender(response, res);
                })
                .catch(err => {
                    console.error('Error status: ', err);
                    generalApiErrorHandler(response, err);
                });
        } else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    }).catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// GET /user/feedback/witdraw/:id - get feedback witdraw (relevant message and 3 before/after)
router.get('/feedback/witdraw/:id', (request, response) => {
    console.log('api: GET /user/feedback/witdraw/:id');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const feedbackId = parseInt(request.params.id, 10);
            if (isNaN(feedbackId)) {
                return generalApiErrorHandler(response, { status: 400, message: 'Invalid feedback id' });
            }
            feedbackDAO.getFeedbackDetail(feedbackId)
                .then(res => {
                    // Only allow access if the feedback belongs to the user
                    if (!res || res.feedback.user_id !== myId) {
                        return generalApiErrorHandler(response, { status: 403, message: 'Forbidden' });
                    }
                    generalApiResponseSender(response, res);
                })
                .catch(err => {
                    console.error('Error status: ', err);
                    generalApiErrorHandler(response, err);
                });
        } else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    }).catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// User start

router.post('/register', (request, response) => {
    console.log('api: POST /user/register');
    const body = request.body;
    console.log('received user/register request: ', body);
    const obj = user.createNewUser(body);
    obj.then(res => {
        // console.log('responding with: ', res);
        if (typeof res !== 'number') {
            generalApiResponseSender(response, res);
        }
        else {
            generalApiErrorHandler(response, res);
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.post('/register/verify', (request, response) => {
    console.log('api: POST /user/register/verify');
    const body = request.body;
    console.log('received user/register/verify request: ', body);
    const obj = user.verifyUserAccountEmailForRegistrationByVerificaitonUrl(body);
    obj.then(res => {
        // console.log('responding with: ', res);
        if (typeof res !== 'number') {
            io.in(res.user.id.toString()).emit('sign in', { access_token: res.token })
            generalApiResponseSender(response, res);
        }
        else {
            generalApiErrorHandler(response, res);
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.post('/register/verify/resend', (request, response) => {
    console.log('api: POST /user/register/verify/resend');
    const body = request.body;
    console.log('received user/register/verify/resend request: ', body);
    const obj = user.resendRegEmail(body);
    obj.then(res => {
        // console.log('responding with: ', res);
        if (typeof res !== 'number') {
            generalApiResponseSender(response, res);
        }
        else {
            generalApiErrorHandler(response, res);
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.post('/google/auth', (request, response) => {
    console.log('api: POST /user/google/auth');
    const body = request.body;
    console.log('received user/google/auth request: ', body);

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            body.myId = myId;

            const googleAuth = user.googleAuth(body);
            googleAuth.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
});

router.post('/microsoft/auth', (request, response) => {
    console.log('api: POST /user/microsoft/auth');
    const body = request.body;
    console.log('received user/microsoft/auth request: ', body);

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            body.myId = myId;

            const microsoftAuth = user.microsoftAuth(body);
            microsoftAuth.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
});

router.get('/unsubscribe/:url', (request, response) => {
    console.log('api: POST /user/unsubscribe/:url');
    const params = request.params;
    console.log('received user/unsubscribe/:url request: ', params);
    const obj = user.getUnsubscribeUrlByUrl(params);
    obj.then(res => {
        // console.log('responding with: ', res);
        if (typeof res !== 'number') {
            generalApiResponseSender(response, res);
        }
        else {
            generalApiErrorHandler(response, res);
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
})

router.put('/unsubscribe', (request, response) => {
    console.log('api: PUT /user/unsubscribe');
    const body = request.body;
    console.log('received user/unsubscribe request: ', body);
    const obj = user.unsubscribeAsUser(body);
    obj.then(res => {
        // console.log('responding with: ', res);
        if (typeof res !== 'number') {
            generalApiResponseSender(response, res);
        }
        else {
            generalApiErrorHandler(response, res);
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
})

router.post('/forgotpassword', (request, response) => {
    console.log('api: POST /user/forgotpassword');
    const body = request.body;
    console.log('received user/forgotpassword request: ', body);
    const obj = user.sendResetPasswordEmail(body.email);
    obj.then(res => {
        // console.log('responding with: ', res);
        if (typeof res !== 'number') {
            generalApiResponseSender(response, res);
        }
        else {
            generalApiErrorHandler(response, res);
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.post('/resetpassword', (request, response) => {
    console.log('api: POST /user/resetpassword');
    const body = request.body;
    console.log('received user/resetpassword request: ', body);
    const obj = user.resetPassword(body.url, body.password);
    obj.then(res => {
        // console.log('responding with: ', res);
        if (typeof res !== 'number') {
            generalApiResponseSender(response, res);
        }
        else {
            generalApiErrorHandler(response, res);
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// User end

// Account start

router.get('/account', (request, response) => {
    console.log('api: GET /user/account');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const getUserAccountInfoById = user.getUserAccountInfoById(myId);
            getUserAccountInfoById.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
});

router.put('/account', (request, response) => {
    console.log('api: PUT /user/account');
    const body = request.body;
    console.log('received user/account request: ', body);

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            body.myId = b_tokenValidated.userId;

            const updateUserAccountInfoById = user.updateUserAccountInfoById(body);
            updateUserAccountInfoById.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    io.in(b_tokenValidated.userId.toString()).emit('update account');
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

router.get('/account/email/verify/:url', (request, response) => {
    console.log('api: GET /user/account/email/verify/:url');
    const params = request.params;
    console.log('received user/account/email/verify/:url request: ', params);

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const req = {
                myId: b_tokenValidated.userId,
                url: params.url
            }
            user.updateUserAccountEmailByVerificationUrl(req).then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

router.put('/account/email', (request, response) => {
    console.log('api: PUT /user/account/email');
    const body = request.body;
    console.log('received user/account/email request: ', body);

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            body.myId = b_tokenValidated.userId;

            user.resendEmailVerificationLink(body).then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

router.put('/account/photo', multer().any(), async (request, response) => {
    console.log('api: PUT /user/account/photo');
    const body = request.body;
    console.log('received user/account/photo request: ', body);

    const { files } = request;
    if (files.length != 1) {
        response.status(400).send("No file uploaded");
    }

    let { buffer, originalname: filename, encoding, mimetype, size } = files[0];

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            body.myId = b_tokenValidated.userId;
            body.buffer = buffer;

            const updateUserPhotoById = user.updateUserPhotoById(body);
            updateUserPhotoById.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    io.in(b_tokenValidated.userId.toString()).emit('update account');
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

// Account end

// Profile start

router.get('/profile/other/:id', (request, response) => {
    console.log('api: GET /user/profile/other/:id');
    const { id } = request.params;
    const getUserProfileById = user.getUserProfileById(id);
    getUserProfileById.then(res => {
        // console.log('responding with: ', res);
        if (typeof res !== 'number') {
            generalApiResponseSender(response, res);
        }
        else {
            generalApiErrorHandler(response, res);
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.get('/profile/my', (request, response) => {
    console.log('api: GET /user/profile/my');

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const getUserProfileById = user.getUserProfileById(myId);
            getUserProfileById.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })

});

// For updating profile, there should be two steps.
// First: If there's a new resume, upload the resume and update the resume url in the database.
// Second: Handle the rest of the data.

router.put('/profile/resume', multer().any(), async (request, response) => {
    console.log('api: PUT /user/profile/resume');
    const body = request.body;
    console.log('received user/profile/resume request: ', body);

    const { files } = request;
    if (files.length != 1) {
        response.status(400).send("No file uploaded");
    }

    let { buffer, originalname, encoding, mimetype, size } = files[0];

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            body.myId = b_tokenValidated.userId;
            body.buffer = buffer;
            body.originalname = originalname;

            const updateUserProfileResumeById = user.updateUserProfileResumeById(body);
            updateUserProfileResumeById.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    io.in(b_tokenValidated.userId.toString()).emit('update account');
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

router.put('/profile', (request, response) => {
    console.log('api: PUT /user/profile');
    const body = request.body;
    console.log('received user/profile request: ', body);


    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            body.myId = b_tokenValidated.userId;
            body.userId = b_tokenValidated.userId;

            const updateUserProfileById = user.updateUserProfileById(body);
            updateUserProfileById.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    io.in(b_tokenValidated.userId.toString()).emit('update account');
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

// Profile end

// Notification start

router.get('/notification', (request, response) => {
    console.log('api: GET /user/notification');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const getNotificationList = user.getNotificationList(myId);
            getNotificationList.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
});

router.get('/notification/read/:id', (request, response) => {
    console.log('api: GET /user/notification/read/:id');
    const { id } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const readNotificationById = user.readNotificationById({
                myId,
                notificationId: id
            });
            readNotificationById.then(res => {
                // console.log('responding with: ', res);
                io.in(b_tokenValidated.userId.toString()).emit('update notification');
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
});

router.delete('/notification/delete/:id', (request, response) => {
    console.log('api: DELETE /user/notification/delete/:id');
    const { id } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const deleteNotificationById = user.deleteNotificationById({
                myId,
                notificationId: id
            });
            deleteNotificationById.then(res => {
                // console.log('responding with: ', res);
                io.in(b_tokenValidated.userId.toString()).emit('update notification');
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
});

// Notification end

// Password start

router.get('/checkpassword', (request, response) => {
    console.log('api: GET /user/checkpassword');
    console.log(`Checking current user's password`);
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const checkPasswordByUserId = user.checkPasswordByUserId(myId);
            checkPasswordByUserId.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
});

router.put('/updatepassword', (request, response) => {
    console.log('api: PUT /user/updatepassword');
    console.log(`Updating current user's password`);
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const body = request.body;
            const keys = ['password', 'oldPassword'];
            if (!validateBodyWithKeys(body, keys)) {
                response.status(403).send('Invalid input');
            }
            else {
                const uid = b_tokenValidated.userId;
                const username = b_tokenValidated.username;
                const updateLastActive = user.updateLastActive(uid, request);
                console.log('body.password: ', body.password);
                console.log('body.oldPassword: ', body.oldPassword);
                const password = body.password;
                const oldPassword = body.oldPassword;
                user.confirmPassword(oldPassword, username).then(r => {
                    if (r === 1) {
                        const updatePasswordByUserId = user.updatePasswordByUserId(password, uid);
                        updateLastActive.then(() => {
                            updatePasswordByUserId.then(() => {
                                const res = { success: true };
                                generalApiResponseSender(response, res);
                            })
                            .catch((err) => {
                                generalApiErrorHandler(response, err);
                            })
                        })
                        .catch((err) => {
                            generalApiErrorHandler(response, err);
                        })
                    }
                    else {
                        if (!response.headersSent) {
                            response.status(403).send("Old password is not correct.")
                        }
                    }
                })
            }
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

router.put('/confirmpassword', (request, response) => {
    console.log('api: PUT /user/confirmpassword');
    console.log(`Confirming current user's password`);
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const body = request.body;
            const uid = b_tokenValidated.userId;
            const updateLastActive = user.updateLastActive(uid, request);
            console.log('body: ', body);
            let confirmPassword;
            // console.log('b_tokenValidated: ', b_tokenValidated);
            confirmPassword = user.confirmPassword(body.password, b_tokenValidated.username);
            updateLastActive.then(() => {
                confirmPassword.then(u => {
                    // console.log(u);
                    // response.send(snake2Camel(u));
                    if (u === 1) {
                        const res = { success: true };
                        generalApiResponseSender(response, res);
                    }
                    else {
                        response.status(403).send("Your password is wrong. ");
                    }
                })
                .catch((err) => {
                    generalApiErrorHandler(response, err);
                })
            })
            .catch((err) => {
                generalApiErrorHandler(response, err);
            })
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

// Password end

// Onboarding START

router.get('/onboarding/process', (request, response) => {
    console.log('api: GET /user/onboarding/process');
    console.log('received GET user/onboarding/process request');

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const getOnboardingProcess = user.getOnboardingProcess(myId);
            getOnboardingProcess.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.post('/onboarding/process', (request, response) => {
    console.log('api: POST /user/onboarding/process');
    console.log('received POST user/onboarding/process request');

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const step = request.body.step;

            const updateOnboardingProcess = user.updateOnboardingProcess(myId, step);
            updateOnboardingProcess.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    io.in(b_tokenValidated.userId.toString()).emit('onboardingStepUpdated', {
                        step: step
                    });
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Onboarding END

// GET /user/database-connection - fetch current user's database connection
router.get('/database-connection', (request, response) => {
    console.log('api: GET /user/database-connection');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            dbConnDAO.getDatabaseConnectionByUserId(myId)
                .then(res => {
                    generalApiResponseSender(response, res || {});
                })
                .catch(err => {
                    console.error('Error status: ', err);
                    generalApiErrorHandler(response, err);
                });
        } else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    }).catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// PUT /user/database-connection - update or create current user's database connection
router.put('/database-connection', (request, response) => {
    console.log('api: PUT /user/database-connection');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const connectionString = request.body.connectionString;
            dbConnDAO.upsertDatabaseConnectionByUserId(myId, connectionString)
                .then(res => {
                    generalApiResponseSender(response, res);
                })
                .catch(err => {
                    console.error('Error status: ', err);
                    generalApiErrorHandler(response, err);
                });
        } else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    }).catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

router.get('/settings/apibaseurl', (request, response) => {
    console.log('api: GET /user/settings/apibaseurl');

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const getApiBaseUrl = project.getApiBaseUrl(myId);
            getApiBaseUrl.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

router.put('/settings/apibaseurl', (request, response) => {
    console.log('api: PUT /user/settings/apibaseurl');
    const body = request.body;
    console.log('received user/settings/apibaseurl request: ', body);

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const url = body.url;

            const updateApiBaseUrl = project.updateApiBaseUrl(myId, url);
            updateApiBaseUrl.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    io.in(b_tokenValidated.userId.toString()).emit('update account');
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

router.get('/settings/oauthtoken', (request, response) => {
    console.log('api: GET /user/settings/oauthtoken');

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const getOauthToken = project.getOauthToken(myId);
            getOauthToken.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

router.put('/settings/oauthtoken', (request, response) => {
    console.log('api: PUT /user/settings/oauthtoken');
    const body = request.body;
    console.log('received user/settings/oauthtoken request: ', body);

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const oauthToken = body.oauthToken;

            const updateOauthToken = project.updateOauthToken(myId, oauthToken);
            updateOauthToken.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    io.in(b_tokenValidated.userId.toString()).emit('update account');
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

router.get('/settings/llm', (request, response) => {
    console.log('api: GET /user/settings/llm');

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            const getLlmConfig = project.getLlmConfig(myId);
            getLlmConfig.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

router.put('/settings/llm', (request, response) => {
    console.log('api: PUT /user/settings/llm');
    const body = request.body;
    console.log('received user/settings/llm request: ', body);

    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const llmConfig = body;

            const updateLlmConfig = project.updateLlmConfig(myId, llmConfig);
            updateLlmConfig.then(res => {
                // console.log('responding with: ', res);
                if (typeof res !== 'number') {
                    io.in(b_tokenValidated.userId.toString()).emit('update account');
                    generalApiResponseSender(response, res);
                }
                else {
                    generalApiErrorHandler(response, res);
                }
            })
            .catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            )
        }
    }).catch((err) => {
        console.log('verifyToken failed: ', err);
        let errCode = 401;
        let errMsg = "You haven't logged in or token has expired.";
        if (typeof err === 'number') {
            errCode = err;
            errMsg = "Please see error code for more details.";
        }
        generalApiErrorHandler(
            response,
            {
                status: errCode,
                message: errMsg
            }
        )
    })
})

export { router as user };