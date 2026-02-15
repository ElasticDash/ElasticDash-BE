import { S3, GetObjectCommand } from '@aws-sdk/client-s3';
// const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3')
import { Readable } from 'stream';

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const s3 = new S3({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_AK,
        secretAccessKey: process.env.AWS_SAK
    },
    // httpOptions: {
    //     connectTimeout: 5 * 1000,           // 5 seconds to establish connection
    //     timeout: 2 * 60 * 1000,             // 2 minutes total timeout for large files (videos)
    // },
    // // Additional configuration for better handling of large files
    // requestHandler: {
    //     // Set reasonable socket timeout for streaming
    //     socketTimeout: 2 * 60 * 1000,       // 2 minutes socket timeout
    // }
});

export const uploadStream = (body, key, contentLength) => {
    return s3.putObject({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: body,
        ContentLength: contentLength,
    });
};

export const uploadBuffer = (body, key, contentLength) => {
    body = bufferToStream(body);
    return uploadStream(body, key, contentLength);
}

export const uploadBase64Image = async (base64Image, key) => {
    var buf = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ""),'base64')
    var data = {
        Key: key, 
        Body: buf,
        ContentEncoding: 'base64',
        ContentType: 'image/jpeg'
    };
    s3Bucket.putObject(data, function(err, data){
        if (err) { 
        console.log(err);
        console.log('Error uploading data: ', data); 
        } else {
        console.log('successfully uploaded the image!');
        }
    });
}

export const getObject = async (key, range) => {
    const startTime = Date.now();
    console.log('🔍 [S3 GetObject] Starting request for key:', key);
    console.log('📊 [S3 GetObject] Range:', range || 'Full file');
    
    try {
        if (!range) {
            range = null;
        }
        else {
            console.log('📹 [S3 GetObject] Range request: ', range);
        }
        const params = {
            Bucket: BUCKET_NAME,
            Key: key,
            Range: range
        };
        
        const object = await s3.getObject(params);
        const duration = Date.now() - startTime;
        console.log('✅ [S3 GetObject] Success in', duration, 'ms');
        console.log('📝 [S3 GetObject] Response metadata:', {
            ContentType: object.ContentType,
            ContentLength: object.ContentLength,
            LastModified: object.LastModified
        });
        
        return object;
    } catch (err) {
        const duration = Date.now() - startTime;
        console.error('❌ [S3 GetObject] Failed after', duration, 'ms');
        console.error('❌ [S3 GetObject] Error:', err.message);
        console.error('❌ [S3 GetObject] Error code:', err.code || err.name);
        throw new Error(`S3 GetObject failed: ${err.message}`);
    }
};

export const getObjectInString = async (key, range) => {
    try {
        if (!range) {
            range = null;
        }
        else {
            console.log('range: ', range);
        }
        const params = {
            Bucket: BUCKET_NAME,
            Key: key,
            Range: range
        };
        const response = await s3.getObject(params);
        
        const stream = response.Body;
        const chunks = [];
        
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        
        return Buffer.concat(chunks).toString('utf-8'); // Convert the Buffer to a UTF-8 string
    } catch (err) {
        throw new Error(`${err}`);
    }
};

export const getObjectInBuffer = async (key) => {
    const getObjectCommand = new GetObjectCommand({ 
        Bucket: BUCKET_NAME,
        Key: key
    })

    try {
      const response = await s3.send(getObjectCommand)
  
      return new Promise((resolve, reject) => {
        
        const stream = response.Body;

        const chunks = [];
        stream.on('data', (chunk) => {
          chunks.push(chunk);
        });
        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        stream.on('error', (err) => {
          reject(err);
        });
      })
    } catch (err) {
      // Handle the error or throw
      console.error('getObjectInBuffer failed, error: ', err);
      throw new Error(err);
    } 
}

export const deleteObject = async (key) => {
    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: key,
        };
        const object = await s3.deleteObject(params);
        // console.log('object: ', object);
        return object;
    } catch (err) {
        throw new Error(`${err}`);
    }
};

export const emptyS3Directory = async (dir) => {
    const listParams = {
        Bucket: BUCKET_NAME,
        Prefix: dir
    };

    const listedObjects = await s3.listObjectsV2(listParams);

    if (listedObjects.Contents.length === 0) return;

    const deleteParams = {
        Bucket: BUCKET_NAME,
        Delete: { Objects: [] }
    };

    listedObjects.Contents.forEach(({ Key }) => {
        deleteParams.Delete.Objects.push({ Key });
    });

    await s3.deleteObjects(deleteParams);

    if (listedObjects.IsTruncated) await emptyS3Directory(BUCKET_NAME, dir);
}

export const listObjectsByRoute = async (key, startAfter) => {
    console.log('listObjectsByRoute is triggered');
    console.log('key: ', key);
    console.log('startAfter: ', startAfter);
    try {
        const bucketParams = {
            Bucket: BUCKET_NAME,
            Prefix: key,
            StartAfter: startAfter
        }
        const data = await s3.listObjectsV2(bucketParams);
        if (data['Contents'] && Array.isArray(data['Contents'])) {
            console.log('Success, files found: ', data['Contents']['length']);
        }
        
        return data;
    }
    catch (err) {
        console.error('listObjectsV2 failed, error: ', err);
        throw err;
    }
}

export const headObject = async (key) => {
    const startTime = Date.now();
    console.log('🔍 [S3 HeadObject] Starting request for key:', key);
    
    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: key,
        };
        const object = await s3.headObject(params);
        const duration = Date.now() - startTime;
        console.log('✅ [S3 HeadObject] Success in', duration, 'ms');
        console.log('📝 [S3 HeadObject] File metadata:', {
            ContentType: object.ContentType,
            ContentLength: object.ContentLength,
            LastModified: object.LastModified,
            ETag: object.ETag
        });
        
        return object;
    } catch (err) {
        const duration = Date.now() - startTime;
        console.error('❌ [S3 HeadObject] Failed after', duration, 'ms');
        console.error('❌ [S3 HeadObject] Error:', err.message);
        console.error('❌ [S3 HeadObject] Error code:', err.code || err.name);
        throw new Error(`S3 HeadObject failed: ${err.message}`);
    }
};

export function bufferToStream(binary) {

    const readableInstanceStream = new Readable({
      read() {
        this.push(binary);
        this.push(null);
      }
    });

    return readableInstanceStream;
}

export const getS3ObjectContent = async (url) => {
    const bucketName = process.env.S3_BUCKET_NAME;
    const key = url.split('/').pop(); // Extract the file name from the URL

    const params = {
        Bucket: bucketName,
        Key: key,
    };

    const data = await s3.getObject(params);
    return data.Body.toString('utf-8'); // Convert the Buffer to a UTF-8 string
};