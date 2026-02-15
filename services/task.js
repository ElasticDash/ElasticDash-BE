import * as auth from '../controller/auth/auth';
import express from 'express';
import { 
    generalApiResponseSender, 
    generalApiErrorHandler 
} from '../controller/general/tools';
import {
    createSavedTask,
    getSavedTask,
    deleteSavedTask
} from '../controller/user/task';
const router = express.Router();

// Create a saved task
router.post('/', (request, response) => {
    console.log('api: POST /task');
    const { taskName, taskType, taskContent, taskSteps } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            createSavedTask(taskName, taskType, taskContent, taskSteps, myId).then(res => {
                if (res.success) {
                    generalApiResponseSender(response, { taskId: res.savedTaskId });
                } else {
                    generalApiErrorHandler(response, res.error);
                }
            }).catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        } else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            );
        }
    }).catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Get saved tasks
router.get('/list', (request, response) => {
    console.log('api: GET /task/list');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            getSavedTask(myId).then(res => {
                if (res.success !== false) {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res.error);
                }
            }).catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        } else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            );
        }
    }).catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Delete a saved task
router.delete('/single/:taskId', (request, response) => {
    console.log('api: DELETE /task/single/:taskId');
    const { taskId } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            deleteSavedTask(taskId, myId).then(res => {
                if (res.success) {
                    generalApiResponseSender(response, { message: 'Task deleted successfully.' });
                } else {
                    generalApiErrorHandler(response, res.message || res.error);
                }
            }).catch(err => {
                console.error('Error status: ', err);
                generalApiErrorHandler(response, err);
            });
        } else {
            generalApiErrorHandler(
                response,
                {
                    status: 401,
                    message: "You haven't logged in or token has expired."
                }
            );
        }
    }).catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

export { router as task };