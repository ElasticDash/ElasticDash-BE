import { pool } from '../../postgres';
import * as crypto from '../auth/crypto';
import { PAGE_SIZE } from '../../src/constants';
import { snake2Camel } from '../general/tools';
const uuidv1 = require('uuid/v1');

export const generateUserWithVerificationCode = (email, fullName, myId = 0) => {
    console.log('generateUserWithVerificationCode is triggered');
    const password = crypto.saltHashPassword('Welcome123');
    console.log('email: ', email);
    console.log('fullName: ', fullName);
    console.log('myId: ', myId);

    const query = `
        INSERT INTO Users
        (
            email, password, full_name, 
            validating_code, email_verified,
            created_by, updated_by
        )
        VALUES
        ($1, $2, $3, $4, true, $5, $5)
        RETURNING id;
    `;

    const values = [email, password, fullName, Math.floor(Math.random() * 1000000), myId];

    return pool.query(query, values)
    .then(r => {
        if (!r.rowCount) {
            return 404;
        }

        return r.rows[0];
    })
    .catch(err => {
        console.error('query failed, error: ', err);
        throw typeof err == 'number' ? err : 500;
    })
}

export const searchUsersByEmailOrName = (searchTerm) => {
    console.log('searchUsersByEmailOrName is triggered');
    console.log('searchTerm: ', searchTerm);

    const query = `
        SELECT id, email, full_name, photo_url
        FROM Users
        WHERE deleted = false
        AND (email ILIKE $1 OR full_name ILIKE $1)
        ORDER BY full_name ASC
        LIMIT 10;
    `;

    const values = [`%${searchTerm}%`];

    return pool.query(query, values)
    .then(r => {
        if (!r.rowCount) {
            return 404;
        }

        return r.rows;
    })
    .catch(err => {
        console.error('query failed, error: ', err);
        throw typeof err == 'number' ? err : 500;
    })
}

export const updatePasswordByUserId = (password, userId, myId) => {
    console.log('updatePasswordByUserId is triggered');
    console.log('password: ', password);
    console.log('userId: ', userId);
    console.log('myId: ', myId);

    // 修改密码之前把密码转码为JWT形式
    password = crypto.saltHashPassword(password).toString();
    console.log('password: ', password);
    console.log('userId: ', userId);
    console.log('myId: ', myId);
    const query = `
        UPDATE users
        SET password = $1,
        updated_at = now(),
        updated_by = $3
        WHERE id = $2
        AND deleted = false
        RETURNING *;
    `;

    const values = [password, userId, myId];

    return pool.query(query, values)
        .then(results => {
            console.log('Updated User ' + userId + ' Password to: ' + password);
            console.log('results.rows: ', results.rows);
            return { message: 'Update password success' };
        })
        .catch((err) => {
            console.error('query error: ', err)
            return 500;
        });
};

export const updateUserAccountEmailById = async (email, userId, myId) => {
    console.log('updateUserAccountEmailById (admin) is triggered');
    console.log('email: ', email);
    console.log('userId: ', userId);
    console.log('myId: ', myId);

    const query = `
        UPDATE Users 
        SET 
            email = $1,
            updated_at = now(),
            updated_by = $3
        WHERE id = $2
        AND deleted = false
        RETURNING full_name, email, photo_url;
    `;

    const values = [
        email,
        userId,
        myId
    ];

    const disable_unsubscription_url_query = `
        UPDATE UnsubscriptionUniqueUrls 
        SET disabled = true, 
        updated_at = now(), 
        updated_by = $2
        WHERE disabled = false 
        AND used = false 
        AND user_id = $1
        AND user_type = 2;
    `;

    const unsubscription_url_query = `
        INSERT INTO UnsubscriptionUniqueUrls 
        (email, url, user_id, created_by, updated_by) 
        VALUES 
        ($1, $2, $3, $4, $4);
    `;

    const disable_unsubscription_url_values = [userId, myId];

    const unsubscription_url_values = [
        email,
        new Date().getTime().toString() + uuidv1().replace(/-/g, ''),
        userId,
        myId
    ];

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

export const deleteUserByUserId = (uid, myId) => {
    console.log('deleteUserByUserId is triggered');
    console.log('uid: ', uid);
    console.log('myId: ', myId);
    const query = `
        UPDATE users
        SET deleted = true,
        updated_at = now(),
        updated_by = $2
        WHERE id = $1
        AND deleted = false
        RETURNING *;
    `;

    const values = [uid, myId];

    return pool.query(query, values)
        .then(results => {
            console.log('Deleted User');
            console.log('results.rows: ', results.rows);
            return { success: true, id: uid };
        })
        .catch((err) => {
            console.error('query error: ', err)
            return 500;
        });
};
