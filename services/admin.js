import * as ad_user from '../controller/administration/user.js';
import { verifyToken } from '../controller/auth/auth';
import { generalApiResponseSender, generalApiErrorHandler } from '../controller/general/tools';
import express from 'express';
import { io } from '../index.js';
const router = express.Router();

// User START

/*
This is an example.

router.get('/allrealusers', (request, response) => {
    console.log('api: GET /admin/allrealusers');
    console.log('Get all real users');
    verifyToken(request, response, { role: 'Admin' }).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const updateLastActive = user.updateLastActive(myId, request);
            const getAllRealUsers = ad_user.getAllRealUsers();
            updateLastActive.then(() => {
                getAllRealUsers.then(r => {
                    generalApiResponseSender(response, r);
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
*/

router.post('/user', (request, response) => {
    console.log('api: POST /admin/user');
    const body = request.body;
    console.log('received admin/user request: ', body);
    verifyToken(request, response, { role: 'Admin' }).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const obj = ad_user.generateUserWithVerificationCode(body.email, body.fullName, myId);
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

router.get('/user/search', (request, response) => {
    console.log('api: GET /admin/user/search');
    const queryParams = request.query;
    console.log('received admin/user/search request: ', queryParams);
    verifyToken(request, response, { role: 'Admin' }).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const obj = ad_user.searchUsersByEmailOrName(queryParams.q);
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

router.put('/user/password', (request, response) => {
    console.log('api: PUT /admin/user/password');
    const body = request.body;
    console.log('received admin/user/password request: ', body);
    verifyToken(request, response, { role: 'Admin' }).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const obj = ad_user.updatePasswordByUserId(body.password, body.userId, myId);
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

router.put('/user/email', (request, response) => {
    console.log('api: PUT /admin/user/email');
    const body = request.body;
    console.log('received admin/user/email request: ', body);
    verifyToken(request, response, { role: 'Admin' }).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const obj = ad_user.updateUserAccountEmailById(body.email, body.userId, myId);
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

router.delete('/user/delete/:userId', (request, response) => {
    console.log('api: DELETE /admin/user/delete/:userId');
    verifyToken(request, response, { role: 'Admin' }).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            const obj = ad_user.deleteUserByUserId(request.params.userId, myId);
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

// User END

// Test API START

router.get('/test', (request, response) => {
    console.log('api: GET /admin/test');
    const { query, params, body, headers } = request;
    console.log('query: ', query);
    console.log('params: ', params);
    console.log('body: ', body);
    console.log('headers: ', headers);

    // console.log('response: ', response);
    generalApiResponseSender(response, { status: 200, message: 'Test API GET is working.' });
});

router.post('/test', (request, response) => {
    console.log('api: POST /admin/test');
    const { query, params, body, headers } = request;
    console.log('query: ', query);
    console.log('params: ', params);
    console.log('body: ', body);
    console.log('headers: ', headers);

    // console.log('response: ', response);
    generalApiResponseSender(response, { status: 200, message: 'Test API POST is working.' });
});

router.put('/test', (request, response) => {
    console.log('api: PUT /admin/test');
    const { query, params, body, headers } = request;
    console.log('query: ', query);
    console.log('params: ', params);
    console.log('body: ', body);
    console.log('headers: ', headers);

    // console.log('response: ', response);
    generalApiResponseSender(response, { status: 200, message: 'Test API PUT is working.' });
});

router.delete('/test', (request, response) => {
    console.log('api: DELETE /admin/test');
    const { query, params, body, headers } = request;
    console.log('query: ', query);
    console.log('params: ', params);
    console.log('body: ', body);
    console.log('headers: ', headers);

    // console.log('response: ', response);
    generalApiResponseSender(response, { status: 200, message: 'Test API DELETE is working.' });
});

// Test API END

// Socket API START

router.post('/socket', (request, response) => {
    console.log('api: POST /admin/socket');
    const { query, params, body, headers } = request;
    console.log('query: ', query);
    console.log('params: ', params);
    console.log('body: ', body);
    console.log('headers: ', headers);

    const event = body.event || 'message';

    if (body.room == 'all') {
        io.emit(event, body.message);
    }
    else {
        io.to(body.room).emit(event, body.message);
    }
    // console.log('response: ', response);
    generalApiResponseSender(response, { status: 200, message: 'Socket API is working.' });
});

// Socket API END

export { router as admin };