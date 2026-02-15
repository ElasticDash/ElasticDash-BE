import jwt from 'jsonwebtoken';
import { validatePassword } from './crypto';
import { 
    getUserByEmail
} from '../user/user';
import { pool } from '../../postgres';
import { io } from '../..';
// import { getIdFromRoleName } from '../role/role';

const sessions = {};

export const checkLogin = (username, password, rememberme, sessionId) => {
    // console.log('auth receives auth/login request: username: ', username, ', password: ', password);
    username = username.replace(/ /g, '').toLowerCase();
    if (username.includes('@') && username.includes('.')) {
        console.log('This is an email');
        const userpassword = getUserByEmail(username);
        return userpassword.then(async (res)=>{
            if(res && typeof res === 'object'){
                console.log('got username & password: ', res);
                if (!res.password) {
                    res.password = '';
                }
                console.log('isNaN(password): ', isNaN(password));
                const b_validated = isNaN(password)
                ? validatePassword(password, res.password)
                : password == res.validating_code;
                console.log('b_validated: ', b_validated);
                if(b_validated) {
                    const token = await generateAuthToken(res.username, res.role_id, res.id, rememberme, res.email);
                    delete res['password'];
                    delete res['validating_code'];
                    if (sessionId) {
                        sessions[sessionId] = {
                            token,
                            timeout: new Date().getTime() + 1000 * 60 * 5
                        };
                        io.in(sessionId).emit('sign in', { accessToken: token, userId: res.id });
                    }
                    return {
                        token: token,
                        user: res
                    }
                } else if (res.validating_code == password && !res.password) {
                    const token = await generateAuthToken(res.username, res.role_id, res.id, rememberme, res.email);
                    delete res['password'];
                    delete res['validating_code'];
                    if (sessionId) {
                        sessions[sessionId] = {
                            token,
                            timeout: new Date().getTime() + 1000 * 60 * 5
                        };
                    }
                    if (sessionId) {
                        sessions[sessionId] = token;
                        io.in(sessionId).emit('sign in', { accessToken: token, userId: res.id });
                    }
                    return {
                        token: token,
                        user: res
                    }
                }
                else { return 404 }
            } 
            else if (res && typeof res === 'number') {
                return res;
            }
            else { return 404 }
        })
    } else {
        console.log('This is an invalid input, abort.');
        return 403;
    }
    
};

export const oauthLogin = userId => {
    console.log('oauthLogin is triggered');
    console.log('userId: ', userId);
    const query = `
        SELECT username, role_id, id, email
        FROM Users
        WHERE id = $1
        AND deleted = false;
    `;

    const values = [userId];
    return pool.query(query, values).then(async r => {
        if (!r.rowCount) {
            return 404;
        }

        const res = r.rows[0];

        if (typeof res === 'number') {
            throw res;
        }
        const token = await generateAuthToken(res.username, res.role_id, res.id, false, res.email);
        return {
            token: token,
            user: res, 
            oauth: true 
        }
    })
};

export const decodeAuthToken = token => {
    console.log('decodeAuthToken is triggered');
    console.log('token: ', token);
    const decoded = authDecodeAuthToken(token);
    console.log('decoded: ', decoded);
    if (decoded && decoded.payload) {
        return decoded.payload;
    }
    else {
        return false;
    }
};

export const getSession = sessionId => {
    console.log('getSession is triggered');
    console.log('sessionId: ', sessionId);
    if (sessions[sessionId]) {
        return sessions[sessionId];
    }
    else {
        return false;
    }
}

export const verifyToken = async (req, res, expectations, next) => {
    // console.log('req: ', req);
    // console.log('res: ', res);
    // console.log('expectations: ', expectations);
    // console.log('next: ', next);
    // console.log('req.headers: ', req.headers);
    // console.log('req.body.apiToken: ', req.body.apiToken);
    let token = req.headers["x-access-token"] || req.headers["authorization"];
    // if(!token) return res.status(401).send("Unauthorized");
    if (token) {
        token = token.split("Bearer ");
    } 
    else {
        token = '';
    }
    if (Array.isArray(token) && token.length > 1) {
        token = token[1].toString().trim(); //req.get('authorization').split("Bearer ")[1].toString();
    }
    // console.log('TOKEN: ', token);

    let apiToken = req.headers["api-token"] || req.body["apiToken"];

    if (apiToken) {
        console.log('apiToken: ', apiToken);
    }
    else {
        apiToken = '';
    }

    try{
        if (apiToken && typeof apiToken === 'string' && apiToken !== 'undefined' && apiToken !== 'null' && apiToken !== '') {
            const checkApiTokenResult = await checkApiToken(apiToken);
            console.log('checkApiTokenResult: ', checkApiTokenResult);
            
            return checkApiTokenResult;
        }

        //console.log('decodeAuthToken: ', decodeAuthToken(token));
        if(expectations.role && await checkRoleIsNotAllowed(token, expectations.role)) {
            // console.log('expectations.role: ', expectations.role);
            // console.log('checkRoleIsNotAllowed(token, expectations.role): ', checkRoleIsNotAllowed(token, expectations.role));
            // console.log("Failed at role check"); 
            return false;
        }

        const decoded = jwt.verify(
            token, 
            //PUBLIC_KEY, 
            process.env.SECRET,
            {expiresIn: "6h"}
        );
        // console.log("decoded: ", decoded);
        // console.log("expectations: ", expectations);
        return {
            // role: expectations.role, 
            // scope: expectations.scope, 
            // userId: decodeAuthToken(token).payload.userId, 
            token: token,
            email: decoded.email,
            username: decoded.username,
            userId: decoded.scopeId,
            role: decoded.role
        };
    } catch(err){
        // console.error("Error verifying JWT token: ", err);
        return false;
    }
};

export const checkApiToken = async (apiKey) => {
    console.log('checkApiKey is triggered');
    console.log('apiKey: ', apiKey);

    const query = `
        SELECT t.user_id, u.email, u.username, u.role_id AS scope_id, r.name AS role
        FROM UserApiTokens t, Users u, Roles r
        WHERE t.token = $1
        AND t.status = 1
        AND t.user_id = u.id
        AND u.role_id = r.id
        AND u.deleted = false
        AND t.deleted = false;
    `;
    const values = [apiKey];
    return pool.query(query, values).then(r => {
        console.log('r.rowCount: ', r.rowCount);

        if (!r.rowCount) {
            console.error('token not found. Abort.');
            throw 401;
        }
        return {
            email: r.rows[0].email,
            username: r.rows[0].username,
            userId: r.rows[0].user_id,
            role: r.rows[0].role
        };
    })
    .catch((err) => {
        console.error('checkApiKey failed, error: ', err);
        return 500;
    })
}

export const verifyTokenRole = async (req, res, expectations, next) => {
    // console.log('req: ', req);
    // console.log('res: ', res);
    // console.log('expectations: ', expectations);
    // console.log('next: ', next);
    let token = req.headers["x-access-token"] || req.headers["authorization"];
    // console.log('token (before treated): ', token);
    if(!token) return res.status(401).send("Unauthorized");
    token = token.split("Bearer ")[1].toString().trim(); //req.get('authorization').split("Bearer ")[1].toString();
    // console.log('TOKEN: ', token);
    const decoded = jwt.verify(
        token, 
        //PUBLIC_KEY, 
        process.env.SECRET,
        // Apparently this value is not used.
        // {expiresIn: "6h"}
        {}
    );

    console.log('expectations.includes(decoded.role): ', expectations.includes(decoded.role));

    if(expectations.includes(decoded.role)){
        // console.log("decoded: ", decoded);
        // console.log("expectations: ", expectations);
        return {
            // role: expectations.role, 
            // scope: expectations.scope, 
            // userId: decodeAuthToken(token).payload.userId,
            email: decoded.email,
            username: decoded.username,
            userId: decoded.scopeId,
            role: decoded.role
        }
    } else {
        console.log('verifyTokenRole Failed;');
        return res.status(401).send("Unauthorized");
    }
};

const checkRoleIsNotAllowed = (token, expectedRoleName) => {
    // console.log('token: ', token);
    const actualRoleName = exports.getTokenRole(token);
    console.log('expectedRoleName', expectedRoleName);
    console.log('actualRoleName: ', actualRoleName);
    // const rolePromise = getIdFromRoleName(expectedRoleName);
    // return rolePromise.then((roleId) => {
    //     console.log('roleId: ', roleId);
    //     console.log('expectedRoleId: ', roleId.id);
    //     console.log('token role Id: ', getTokenRoleId(token));
    //     console.log('(getTokenRoleId(token) !== roleId.id): ', getTokenRoleId(token) !== roleId.id);
    //     return !(getTokenRoleId(token) <= roleId.id);
    // })
    // .catch((err) => {
    //     console.error('rolePromise failed, error: ', err);
    //     throw err;
    // })
    console.log('(actualRoleName === expectedRoleName): ', actualRoleName === expectedRoleName);
    // return !(getTokenRole(token) <= expectedRoleName);
    return actualRoleName !== expectedRoleName;
}

const generateAuthToken = async (username, roleId, scopeId, rememberme, email) => {
    // let expiresIn = '6h';
    // if (rememberme) {
    //     expiresIn = '7d';
    // }
    let expiresIn = '60d';
    const role_query = `
        SELECT name
        FROM Roles
        WHERE id = $1;
    `;
    // const roleArray = [
    //     null,
    //     'Admin'
    // ];
    let role = null;
    if (typeof roleId === 'number' && roleId > 0) {
        // role = roleArray[roleId];
        const role_values = [roleId];
        await pool.query(role_query, role_values)
        .then(ro => {
            if (!ro.rowCount) {
                console.error('role not exist');
                return 404;
            }
            else {
                role = ro.rows[0].name;
                return true;
            }
        })
        .catch((err) => {
            console.error('role_query failed, error: ', err);
            return 500;
        })
    }
    const payload = {
        username: username,
        role: role,
        scopeId: scopeId,
        email: email
    }
    const signOptions = {
        expiresIn: expiresIn,
        // I have no idea where this algorithm come from and it appears it is not working.
        // algorithm: "RS256"
    }
    let token;
    if (role == 'Influencer') {
        token = jwt.sign(payload,
            process.env.SECRET,//PRIVATE_KEY,
        );
    }
    else {
        token = jwt.sign(payload,
            process.env.SECRET,//PRIVATE_KEY,
            signOptions
        );
    }
    console.log('expiresIn: ', expiresIn);
    console.log('Generated Token: ', token);
    return token;
}

const authDecodeAuthToken = token => {
    return jwt.decode(token, {complete:true});
}

export const getTokenRoleId = token => {
    return authDecodeAuthToken(token).payload.roleId;
};

export const getTokenRole = token => {
    return authDecodeAuthToken(token).payload.role;
};

const isIncludeLetter = strData => { 
    if(!strData) {
      return false;
    }
    const reg = /[a-z]/i;
    if (!reg.test(strData)) {
      return false;
    }
    return true;
}

const isIncludeNumber = strData => {
    if(!strData){
      return false;
    }
    const reg = /[0-9]/;
    if (!reg.test(strData))
    {
      return false;
    }
    return true;
}