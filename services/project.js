import * as auth from '../controller/auth/auth';
import express from 'express';
import { io } from '../index.js';
import { 
    generalApiResponseSender, 
    generalApiErrorHandler 
} from '../controller/general/tools';
import {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
    createDatabase,
    getDatabases,
    updateDatabase,
    deleteDatabase,
    createAccessToken,
    getAccessTokens,
    updateAccessToken,
    deleteAccessToken
} from '../controller/project/project';

// Staging/KB version controllers
import {
    uploadOpenApi,
    uploadSqlDdl,
    generateTableTxt,
    listDraftTables,
    listActiveTables,
    getDraftTable,
    createDraftTable,
    updateDraftTable,
    deleteDraftTable,
    submitDraftKb,
    submitDraftKbApi,
    submitDraftKbTable,
    promoteToActive,
    discardDraft,
    // New API endpoints
    listDraftApis,
    listActiveApis,
    getDraftApi,
    updateDraftApi,
    deleteDraftApi,
    createDraftApi
} from '../controller/project/staging';

import { buildRagForProject, buildRagForApis, buildRagForTables } from '../controller/project/rag';

const router = express.Router();

// ==================== RAG PROJECTS ====================

// Create a new project
router.post('/projects', (request, response) => {
    console.log('api: POST /project/projects');
    const { projectName, uniqueKey, description } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            createProject(projectName, uniqueKey, description, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// Get all projects
router.get('/projects', (request, response) => {
    console.log('api: GET /project/projects');
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            getProjects(myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// Get a single project
router.get('/projects/:projectId', (request, response) => {
    console.log('api: GET /project/projects/:projectId');
    const { projectId } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            getProjectById(projectId, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// Update a project
router.put('/projects/:projectId', (request, response) => {
    console.log('api: PUT /project/projects/:projectId');
    const { projectId } = request.params;
    const { projectName, description, status } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            updateProject(projectId, projectName, description, status, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// Delete a project
router.delete('/projects/:projectId', (request, response) => {
    console.log('api: DELETE /project/projects/:projectId');
    const { projectId } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            deleteProject(projectId, myId).then(res => {
                if (res.success || typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// ==================== RAG DATABASES ====================

// Create a new database
router.post('/databases', (request, response) => {
    console.log('api: POST /project/databases');
    const { projectId, dbType, connectionString } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            createDatabase(projectId, dbType, connectionString, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// Get all databases for a project
router.get('/projects/:projectId/databases', (request, response) => {
    console.log('api: GET /project/projects/:projectId/databases');
    const { projectId } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            getDatabases(projectId, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// Update a database
router.put('/databases/:databaseId', (request, response) => {
    console.log('api: PUT /project/databases/:databaseId');
    const { databaseId } = request.params;
    const { dbType, connectionString, status } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            updateDatabase(databaseId, dbType, connectionString, status, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// Delete a database
router.delete('/databases/:databaseId', (request, response) => {
    console.log('api: DELETE /project/databases/:databaseId');
    const { databaseId } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            deleteDatabase(databaseId, myId).then(res => {
                if (res.success || typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// ==================== RAG PROJECT ACCESS TOKENS ====================

// Create a new access token
router.post('/access-tokens', (request, response) => {
    console.log('api: POST /project/access-tokens');
    const { projectId, sourceType, sourceKey, tokenValue, headerKey, headerValueTemplate } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            createAccessToken(projectId, sourceType, sourceKey, tokenValue, headerKey, headerValueTemplate, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// Get all access tokens for a project
router.get('/projects/:projectId/access-tokens', (request, response) => {
    console.log('api: GET /project/projects/:projectId/access-tokens');
    const { projectId } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            getAccessTokens(projectId, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// Update an access token
router.put('/access-tokens/:tokenId', (request, response) => {
    console.log('api: PUT /project/access-tokens/:tokenId');
    const { tokenId } = request.params;
    const { sourceType, sourceKey, tokenValue, headerKey, headerValueTemplate, status } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            updateAccessToken(tokenId, sourceType, sourceKey, tokenValue, headerKey, headerValueTemplate, status, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// Delete an access token
router.delete('/access-tokens/:tokenId', (request, response) => {
    console.log('api: DELETE /project/access-tokens/:tokenId');
    const { tokenId } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;

            deleteAccessToken(tokenId, myId).then(res => {
                if (res.success || typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
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

// ==================== KNOWLEDGE BASE STAGING (Draft/Active Versions) ====================

// Upload OpenAPI document → parse and upsert draft APIs
router.post('/kb/upload-openapi', (request, response) => {
    console.log('api: POST /project/kb/upload-openapi');
    console.log('DEBUG - Full request.body:', JSON.stringify(request.body, null, 2));
    console.log('DEBUG - request.body type:', typeof request.body);
    const { projectId = 0, openapi } = request.body;
    console.log('DEBUG - Extracted openapi:', openapi);
    console.log('DEBUG - openapi type:', typeof openapi);
    console.log('DEBUG - openapi is null?:', openapi === null);
    console.log('DEBUG - openapi is undefined?:', openapi === undefined);
    if (openapi && typeof openapi === 'object') {
        console.log('DEBUG - openapi keys:', Object.keys(openapi));
    }
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            
            // Return immediate response
            generalApiResponseSender(response, {
                success: true,
                status: 'processing',
                message: 'OpenAPI upload started. Updates will be sent via socket.'
            });
            
            // Process asynchronously without awaiting
            setImmediate(async () => {
                try {
                    const res = await uploadOpenApi(projectId, openapi, myId);
                    
                    if (typeof res !== 'number') {
                        // Send success update via socket
                        io.to(String(myId)).emit('kb:upload-openapi:complete', {
                            status: 'success',
                            data: res
                        });
                        console.log('OpenAPI upload completed, socket update sent to user:', myId);
                    } else {
                        // Send error update via socket
                        io.to(String(myId)).emit('kb:upload-openapi:error', {
                            status: 'failed',
                            error: 'Upload processing failed'
                        });
                        console.log('OpenAPI upload failed, error update sent to user:', myId);
                    }
                } catch (err) {
                    console.error('Error in async OpenAPI upload:', err);
                    io.to(String(myId)).emit('kb:upload-openapi:error', {
                        status: 'failed',
                        error: err.message || 'Unknown error occurred'
                    });
                }
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
        io.to(String(myId)).emit('kb:upload-openapi:error', {
            status: 'failed',
            error: 'Upload processing failed'
        });
    });
});

// Upload SQL DDL → parse and upsert draft tables
router.post('/kb/upload-sql', (request, response) => {
    console.log('api: POST /project/kb/upload-sql');
    const { projectId = 0, databaseId, ddlText } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            
            // Return immediate response
            generalApiResponseSender(response, {
                success: true,
                status: 'processing',
                message: 'SQL DDL upload started. Updates will be sent via socket.'
            });
            
            // Process asynchronously without awaiting
            setImmediate(async () => {
                try {
                    const res = await uploadSqlDdl(projectId, databaseId, ddlText, myId);
                    
                    if (typeof res !== 'number') {
                        // Send success update via socket
                        io.to(String(myId)).emit('kb:upload-sql:complete', {
                            status: 'success',
                            data: res
                        });
                        console.log('SQL DDL upload completed, socket update sent to user:', myId);
                    } else {
                        // Send error update via socket
                        io.to(String(myId)).emit('kb:upload-sql:error', {
                            status: 'failed',
                            error: 'Upload processing failed'
                        });
                        console.log('SQL DDL upload failed, error update sent to user:', myId);
                    }
                } catch (err) {
                    console.error('Error in async SQL DDL upload:', err);
                    io.to(String(myId)).emit('kb:upload-sql:error', {
                        status: 'failed',
                        error: err.message || 'Unknown error occurred'
                    });
                }
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
        io.to(String(myId)).emit('kb:upload-sql:error', {
            status: 'failed',
            error: 'Upload processing failed'
        });
    });
});

// Generate LLM description for a draft table
router.post('/kb/tables/:id/generate', (request, response) => {
    console.log('api: POST /project/kb/tables/:id/generate');
    const { id } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            generateTableTxt(Number(id), myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// List draft tables for a project
router.get('/kb/draft/tables', (request, response) => {
    console.log('api: GET /project/kb/draft/tables');
    const { projectId = 0 } = request.query;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            listDraftTables(Number(projectId), myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// List draft APIs for a project
router.get('/kb/draft/apis', (request, response) => {
    console.log('api: GET /project/kb/draft/apis');
    const { projectId = 0 } = request.query;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            listDraftApis(Number(projectId), myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// List active APIs for a project
router.get('/kb/active/apis', (request, response) => {
    console.log('api: GET /project/kb/active/apis');
    const { projectId = 0 } = request.query;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            listActiveApis(Number(projectId), myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Get single draft API
router.get('/kb/apis/:id', (request, response) => {
    console.log('api: GET /project/kb/apis/:id');
    const { id } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            getDraftApi(Number(id), myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Create draft API (user edits)
router.post('/kb/apis', (request, response) => {
    console.log('api: POST /project/kb/apis');
    const updates = request.body || {};
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            createDraftApi(0, updates, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});


// Update draft API (user edits)
router.put('/kb/apis/:id', (request, response) => {
    console.log('api: PUT /project/kb/apis/:id');
    const { id } = request.params;
    const updates = request.body || {};
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            updateDraftApi(Number(id), updates, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Delete draft API (user edits)
router.delete('/kb/apis/:id', (request, response) => {
    console.log('api: DELETE /project/kb/apis/:id');
    const { id } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            deleteDraftApi(Number(id), myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// List active tables for a project
router.get('/kb/active/tables', (request, response) => {
    console.log('api: GET /project/kb/active/tables');
    const { projectId = 0 } = request.query;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            listActiveTables(Number(projectId), myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Get single draft table
router.get('/kb/tables/:id', (request, response) => {
    console.log('api: GET /project/kb/tables/:id');
    const { id } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            getDraftTable(Number(id), myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Create draft table (user edits schema/description/generated_txt)
router.post('/kb/tables', (request, response) => {
    console.log('api: POST /project/kb/tables');
    const updates = request.body || {};
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            createDraftTable(0, updates, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Update draft table (user edits schema/description/generated_txt)
router.put('/kb/tables/:id', (request, response) => {
    console.log('api: PUT /project/kb/tables/:id');
    const { id } = request.params;
    const updates = request.body || {};
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            updateDraftTable(Number(id), updates, myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Delete draft table
router.delete('/kb/tables/:id', (request, response) => {
    console.log('api: DELETE /project/kb/tables/:id');
    const { id } = request.params;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            deleteDraftTable(Number(id), myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Submit draft KB (mark as submitted, doesn't promote yet)
router.post('/kb/submit', (request, response) => {
    console.log('api: POST /project/kb/submit');
    const { projectId = 0 } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            submitDraftKb(Number(projectId), myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Submit draft KB (mark as submitted, doesn't promote yet)
router.post('/kb/submit/api', (request, response) => {
    console.log('api: POST /project/kb/submit/api');
    const { projectId = 0 } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            
            // Return immediate response
            generalApiResponseSender(response, {
                success: true,
                status: 'processing',
                message: 'API RAG build started. Updates will be sent via socket.'
            });
            
            // Process asynchronously without awaiting
            setImmediate(async () => {
                try {
                    const res = await buildRagForApis(Number(projectId), myId);
                    
                    if (typeof res !== 'number') {
                        // Send success update via socket
                        io.to(String(myId)).emit('kb:submit-api:complete', {
                            status: 'success',
                            data: res
                        });
                        console.log('API RAG build completed, socket update sent to user:', myId);
                    } else {
                        // Send error update via socket
                        io.to(String(myId)).emit('kb:submit-api:error', {
                            status: 'failed',
                            error: 'API RAG build processing failed'
                        });
                        console.log('API RAG build failed, error update sent to user:', myId);
                    }
                } catch (err) {
                    console.error('Error in async API RAG build:', err);
                    io.to(String(myId)).emit('kb:submit-api:error', {
                        status: 'failed',
                        error: err.message || 'Unknown error occurred'
                    });
                }
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
        io.to(String(myId)).emit('kb:submit-api:error', {
            status: 'failed',
            error: 'API RAG build processing failed'
        });
    });
});

// Submit draft KB (mark as submitted, doesn't promote yet)
router.post('/kb/submit/table', (request, response) => {
    console.log('api: POST /project/kb/submit/table');
    const { projectId = 0 } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            
            // Return immediate response
            generalApiResponseSender(response, {
                success: true,
                status: 'processing',
                message: 'Table RAG build started. Updates will be sent via socket.'
            });
            
            // Process asynchronously without awaiting
            setImmediate(async () => {
                try {
                    const res = await buildRagForTables(Number(projectId), myId);
                    
                    if (typeof res !== 'number') {
                        // Send success update via socket
                        io.to(String(myId)).emit('kb:submit-table:complete', {
                            status: 'success',
                            data: res
                        });
                        console.log('Table RAG build completed, socket update sent to user:', myId);
                    } else {
                        // Send error update via socket
                        io.to(String(myId)).emit('kb:submit-table:error', {
                            status: 'failed',
                            error: 'Table RAG build processing failed'
                        });
                        console.log('Table RAG build failed, error update sent to user:', myId);
                    }
                } catch (err) {
                    console.error('Error in async Table RAG build:', err);
                    io.to(String(myId)).emit('kb:submit-table:error', {
                        status: 'failed',
                        error: err.message || 'Unknown error occurred'
                    });
                }
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
        io.to(String(myId)).emit('kb:submit-table:error', {
            status: 'failed',
            error: 'Table RAG build processing failed'
        });
    });
});

// Promote draft → active (ready for RAG)
router.post('/kb/update-rag', (request, response) => {
    console.log('api: POST /project/kb/update-rag');
    const { projectId = 0 } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            promoteToActive(Number(projectId), myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Discard draft → reset from active
router.post('/kb/discard-draft', (request, response) => {
    console.log('api: POST /project/kb/discard-draft');
    const { projectId = 0 } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            discardDraft(Number(projectId), myId).then(res => {
                if (typeof res !== 'number') {
                    generalApiResponseSender(response, res);
                } else {
                    generalApiErrorHandler(response, res);
                }
            }).catch(err => {
                console.error('Error:', err);
                generalApiErrorHandler(response, err);
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    });
});

// Build RAG files (compose separate tables and APIs RAG files, write to rags/, update rag_path)
router.post('/kb/build-rag', (request, response) => {
    console.log('api: POST /project/kb/build-rag');
    const { projectId = 0 } = request.body;
    auth.verifyToken(request, response, {}).then(b_tokenValidated => {
        if (b_tokenValidated && b_tokenValidated.statusCode !== 401) {
            const myId = b_tokenValidated.userId;
            
            // Return immediate response
            generalApiResponseSender(response, {
                success: true,
                status: 'processing',
                message: 'RAG build started. Updates will be sent via socket.'
            });
            
            // Process asynchronously without awaiting
            setImmediate(async () => {
                try {
                    const res = await buildRagForProject(Number(projectId), myId);
                    
                    if (typeof res !== 'number') {
                        // Send success update via socket
                        io.to(String(myId)).emit('kb:build-rag:complete', {
                            status: 'success',
                            data: res
                        });
                        console.log('RAG build completed, socket update sent to user:', myId);
                    } else {
                        // Send error update via socket
                        io.to(String(myId)).emit('kb:build-rag:error', {
                            status: 'failed',
                            error: 'RAG build processing failed'
                        });
                        console.log('RAG build failed, error update sent to user:', myId);
                    }
                } catch (err) {
                    console.error('Error in async RAG build:', err);
                    io.to(String(myId)).emit('kb:build-rag:error', {
                        status: 'failed',
                        error: err.message || 'Unknown error occurred'
                    });
                }
            });
        }
        else {
            generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
    })
    .catch(err => {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
        io.to(String(myId)).emit('kb:build-rag:error', {
            status: 'failed',
            error: err.message || 'Unknown error occurred'
        });
    });
});

export { router as project };
