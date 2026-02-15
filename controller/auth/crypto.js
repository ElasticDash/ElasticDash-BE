import crypto from 'crypto';

function generateSalt(length){
    return crypto.randomBytes(Math.ceil(length/2))
        .toString('hex')
        .slice(0,length);
}

function generateHash(password, salt, iterations = 1000, keylen = 64, digest = 'sha512'){
    //var hash = crypto.createHmac('sha512', salt);
    //hash.update(password);
    //var value = hash.digest('hex');
    const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
    return {
        salt: salt,
        password_hash: hash//value
    };
}

export const saltHashPassword = (
    password, iterations = 1000, keylen = 64, digest = 'sha512'
) => {
    const salt = generateSalt(16);
    if (!password) {
        password = '';
    }
    const passwordData = generateHash(password, salt, iterations, keylen, digest);
    //console.log('UserPassword = '+password);
    //console.log('password_hash = '+passwordData.password_hash);
    //console.log('nSalt = '+passwordData.salt);
    return passwordData.salt + '-' + passwordData.password_hash;
};

export const validatePassword = (password, hashedPassword, iterations = 1000, keylen = 64, digest = 'sha512') => {
    // console.log('validating password: ', password, ' - ', hashedPassword);
    if (!password || !hashedPassword) {
        return false;
    }
    const salt = hashedPassword.split('-')[0];
    const hash = hashedPassword.split('-')[1];
    // console.log('salt is: ', salt);
    // console.log('hash is: ', hash);
    //var saltUserPassword = salt + password;
    const newHash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
    // console.log('newHash is: ', newHash);
    return hash === newHash;
    // return password === hashedPassword;
};

// 加密方法
export const encrypt = (data, key) => {
    // 注意，第二个参数是Buffer类型
    return crypto.publicEncrypt(key, Buffer.from(data));
};

// 解密方法
export const decrypt = (encrypted, key) => {
    // 注意，encrypted是Buffer类型
    return crypto.privateDecrypt(key, encrypted);
};