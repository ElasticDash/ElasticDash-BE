import * as auth from '../controller/auth/auth';
import express from 'express';
import { io } from '../index';
import { generalApiResponseSender, generalApiErrorHandler, snake2Camel } from '../controller/general/tools';
const router = express.Router();

router.post('/login', (request, response) => {
    console.log('api: POST /auth/login');
    const body = request.body;
    console.log('received auth/login request: ', body);
    const obj = auth.checkLogin(
        body.username, 
        body.password, 
        body.rememberme, 
        body.sessionId
    );
    obj.then(res => {
        // console.log('responding with: ', res);
        if (typeof res !== 'number') {
            if (body.sessionId) {
                io.in(body.sessionId).emit('sign in', { access_token: res.token })
            }
            io.in(res.user.id.toString()).emit('sign in', { access_token: res.token })
            res.user = snake2Camel(res.user)
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

router.get('/session/:sessionId', (request, response) => {
    console.log('api: GET /auth/session/:sessionId');
    const sessionId = request.params.sessionId;
    console.log('received auth/session request: ', sessionId);
    const obj = auth.getSession(sessionId);
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

export { router as auth };