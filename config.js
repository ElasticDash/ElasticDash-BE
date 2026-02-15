import dotenv from 'dotenv';

dotenv.config()

// Check environment but use .env file for configuration
if (process.env.KUBERNETES_SERVICE_HOST) {
    console.log('Running in Kubernetes environment, using .env file configuration');
    // Use .env file configuration in K8s
    if (process.env.DB_CONNECTION_STRING) {
        console.log('Using DB_CONNECTION_STRING from .env file');
    } else if (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER) {
        console.log('Using individual DB environment variables from .env');
    }
} else {
    console.log('Running in local environment, using .env file');
}

if (!process.env.S3_BUCKET_NAME) {
    console.error("S3_BUCKET_NAME is not setup in env")
}

if (!process.env.DB_CONNECTION_STRING && !process.env.DB_HOST) {
    console.error("Database configuration is not setup in env")
}

if (!process.env.AWS_SQS_URL_TEST) {
    console.error("AWS_SQS_URL_TEST is not setup in env")
}
