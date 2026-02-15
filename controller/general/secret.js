const AWS = require('aws-sdk');

const SecretsManager = new AWS.SecretsManager();

const { AWS_REGION, AWS_AK, AWS_SAK } = process.env;

AWS.config.update({
    region: AWS_REGION,
    accessKeyId: AWS_AK,
    secretAccessKey: AWS_SAK,
});

export const listSecrets = async () => {
    console.log('listSecrets is triggered');
    try {
        const data = await SecretsManager.listSecrets({}).promise();
        console.log('AWS_REGION: ', AWS_REGION);

        return data;
    } catch (error) {
        console.error("Error listing secrets:", error);

        throw error;
    }
};

export const getSecret = async (secretName) => {
    console.log('getSecret is triggered');
    try {
        const data = await SecretsManager.getSecretValue({ SecretId: secretName }).promise();

        return data;
    } catch (error) {
        console.error("Error getting secret:", error);
        console.log('secretName: ', secretName);
    }
};

export const createSecret = async (secretName, secretValue) => {
    console.log('createSecret is triggered');
    try {
        const data = await SecretsManager.createSecret({
            Name: secretName,
            SecretString: secretValue,
        }).promise();

        return data;
    } catch (error) {
        console.error("Error creating secret:", error);
    }
};

export const updateSecret = async (secretName, secretValue) => {
    console.log('updateSecret is triggered');
    try {
        const data = await SecretsManager.updateSecret({
            SecretId: secretName,
            SecretString: secretValue,
        }).promise();

        return data;
    } catch (error) {
        console.error("Error updating secret:", error);
    }
};

export const deleteSecret = async (secretName) => {
    console.log('deleteSecret is triggered');
    try {
        const data = await SecretsManager.deleteSecret({ SecretId: secretName }).promise();

        return data;
    } catch (error) {
        console.error("Error deleting secret:", error);
    }
};
