import * as secret from '../controller/general/secret';
import { generalApiResponseSender, generalApiErrorHandler } from '../controller/general/tools';
import express from 'express';
import { headObject, getObject } from '../controller/general/file';
import * as aiHandler from '../controller/general/aihandler';
import { verifyToken } from '../controller/auth/auth';
import * as dbHandler from '../controller/general/dbhandler';

const router = express.Router();

// File START

router.get('/files/:key', async (request, response) => {
    const requestStart = Date.now();
    console.log('api: GET /general/files/:key');
    const key = request.params.key;
    console.log('key: ', key);
    console.log('🚀 [File Request] Starting file request for key:', key);
    console.log('📊 [File Request] Request headers:', {
        'user-agent': request.headers['user-agent'],
        'range': request.headers.range,
        'if-range': request.headers['if-range']
    });
    
    return headObject(key)
    .then(async (data) => {
        const headObjectTime = Date.now() - requestStart;
        console.log('✅ [S3 HeadObject] Completed in', headObjectTime, 'ms');
        console.log('📝 [S3 HeadObject] File info:', {
            ContentType: data.ContentType,
            ContentLength: data.ContentLength,
            LastModified: data.LastModified,
            ETag: data.ETag
        });
        
        var range = request.headers.Range;
        const { ContentType: type, ContentLength: length} = data;
        if (data.ETag) response.setHeader("ETag", data.ETag);
        getObject(key)
        .then(object => {
            const getObjectTime = Date.now() - requestStart;
            console.log('✅ [S3 GetObject] Completed in', (getObjectTime - headObjectTime), 'ms');
            console.log('⏱️  [Total Time] HeadObject + GetObject =', getObjectTime, 'ms');
            
            if (typeof object !== 'number') {
                response.setHeader('filename', key);
                
                if (range) {
                    console.log('📹 [Range Request] Serving range:', range);
                    console.log('📊 [Range Request] File size:', length, 'bytes');
                    const parts = range.replace("bytes=", "").split("-");
                    const start = parseInt(parts[0], 10);
                    const end = parts[1]? parseInt(parts[1], 10): length -1;
                    let headers  = {
                        "Content-Range": `bytes ${start}-${end}/${length}`,
                        "Accept-Ranges": "bytes",
                        "Content-Type": type,
                        "Content-Length": end - start + 1,
                        "Last-Modified": data.LastModified,
                     };
        
                     if (request.headers["if-range"]) {
                        //  console.log("Setting if-range to", request.headers["if-range"]);
                         headers["If-Range"] = request.headers["if-range"];
                     }
        
                    console.log('📤 [Range Response] Sending partial content (206)');
                    response.writeHead(206, headers);
                }
                else {
                    console.log('📤 [Full Response] Sending complete file');
                    console.log('📊 [Full Response] File size:', length, 'bytes');
                    response.setHeader("Accept-Ranges", "bytes");
                    response.setHeader("Content-Type", type);
                    response.setHeader("Content-Length", length);
                    response.setHeader("Last-Modified", data.LastModified);
                }
                
                console.log('🔄 [Streaming] Starting to pipe S3 stream to response');
                object.Body.pipe(response);
                
                // Add stream event listeners for better debugging
                object.Body.on('end', () => {
                    const totalTime = Date.now() - requestStart;
                    console.log('✅ [Streaming] Stream ended successfully');
                    console.log('⏱️  [Total Request Time]', totalTime, 'ms');
                });
                
                object.Body.on('error', (streamErr) => {
                    console.error('❌ [Streaming] Stream error:', streamErr);
                });
                
                response.on('close', () => {
                    console.log('🔚 [Response] Client closed connection');
                });
                
                response.on('finish', () => {
                    const totalTime = Date.now() - requestStart;
                    console.log('✅ [Response] Response finished successfully');
                    console.log('⏱️  [Final Total Time]', totalTime, 'ms');
                });
            }
            else {
                // console.log('checkpoint 7');
                response.sendStatus(object);
            }

        })
        .catch((err) => {
            const errorTime = Date.now() - requestStart;
            console.error('❌ [S3 GetObject] Failed after', errorTime, 'ms');
            console.error('❌ [S3 GetObject] Error details:', err);
            console.error('❌ [S3 GetObject] Key:', key);
            console.error('❌ [S3 GetObject] Error name:', err.name);
            console.error('❌ [S3 GetObject] Error message:', err.message);
            console.error('❌ [S3 GetObject] HTTP status:', err.$metadata?.httpStatusCode);
            
            // Return 500 for all S3 errors - detailed info is in logs
            response.sendStatus(500);
        });
    })
    .catch((err) => {
        const errorTime = Date.now() - requestStart;
        console.error('❌ [S3 HeadObject] Failed after', errorTime, 'ms');
        console.error('❌ [S3 HeadObject] Error details:', err);
        console.error('❌ [S3 HeadObject] Key:', key);
        console.error('❌ [S3 HeadObject] Error name:', err.name);
        console.error('❌ [S3 HeadObject] Error message:', err.message);
        console.error('❌ [S3 HeadObject] HTTP status:', err.$metadata?.httpStatusCode);
        
        // Return 500 for all S3 errors - detailed info is in logs
        generalApiResponseSender(response, 500);
    });
})

// File END

// AWS Secret Manager START

router.get('/secret/list', (request, response) => {
    console.log('api: GET /general/secret/list');
    console.log('Get list of secrets');
    const listSecrets = secret.listSecrets();
    listSecrets.then(r => {
        generalApiResponseSender(response, r);
    })
    .catch((err) => {
        generalApiErrorHandler(response, err);
    })
})

router.get('/secret/get/:secretName', (request, response) => {
    console.log('api: GET /general/secret/get/:secretName');
    const secretName = request.params.secretName;
    console.log('secretName: ', secretName);
    const getSecret = secret.getSecret(secretName);
    getSecret.then(r => {
        generalApiResponseSender(response, r);
    })
    .catch((err) => {
        generalApiErrorHandler(response, err);
    })
})

router.post('/secret/create', (request, response) => {
    console.log('api: POST /general/secret/create');
    const secretName = request.body.secretName;
    const secretValue = request.body.secretValue;
    console.log('secretName: ', secretName);
    console.log('secretValue: ', secretValue);
    const createSecret = secret.createSecret(secretName, secretValue);
    createSecret.then(r => {
        generalApiResponseSender(response, r);
    })
    .catch((err) => {
        generalApiErrorHandler(response, err);
    })
})

router.delete('/secret/delete/:secretName', (request, response) => {
    console.log('api: DELETE /general/secret/delete/:secretName');
    const secretName = request.params.secretName;
    console.log('secretName: ', secretName);
    const deleteSecret = secret.deleteSecret(secretName);
    deleteSecret.then(r => {
        generalApiResponseSender(response, r);
    })
    .catch((err) => {
        generalApiErrorHandler(response, err);
    })
})

// AWS Secret Manager END

// Outer API Services START

router.post('/aiservice/xai', (request, response) => {
    console.log('api: POST /general/aiservice/xai');
    const data = request.body;
    console.log('data: ', data);
    verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const sendRequestToXAI = aiHandler.sendRequestToXAI(data);
            sendRequestToXAI.then(r => {
                generalApiResponseSender(response, r);
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

router.post('/aiservice/claude', (request, response) => {
    console.log('api: POST /general/aiservice/claude');
    const data = request.body;
    console.log('data: ', data);
    verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const sendRequestToClaudeAI = aiHandler.sendRequestToClaudeAI(data);
            sendRequestToClaudeAI.then(r => {
                generalApiResponseSender(response, r);
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

router.post('/aiservice/openai', (request, response) => {
    console.log('api: POST /general/aiservice/openai');
    const data = request.body;
    console.log('data: ', data);
    verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const sendRequestToOpenAI = aiHandler.sendRequestToOpenAI(data);
            sendRequestToOpenAI.then(r => {
                generalApiResponseSender(response, r);
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

// Outer API Services END

router.post('/sql/query', async (request, response) => {
    console.log('api: POST /general/sql/query');
    const query = request.body.query;
    console.log('query: ', query);
    
    try {
        const userDetail = await verifyToken(request, response, {});
        let userId = null;
        if (userDetail && userDetail.statusCode !== 401) {
            userId = userDetail.userId;
        }
        const result = await dbHandler.acceptSqlQuery(query, userId);
        generalApiResponseSender(response, result);
    } catch (err) {
        generalApiErrorHandler(response, err);
    }
})

export { router as general };
