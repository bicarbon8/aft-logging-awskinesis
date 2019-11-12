import { AuthenticationType } from "./authentication-type";
import AWS = require('aws-sdk');
import { TestLog, TestLogOptions } from "aft-core";
import { KinesisLoggingConfig } from "./kinesis-logging-config";

export module Authentication {
    var logger: TestLog = new TestLog(new TestLogOptions('tafjs-aws'));

    export async function get(authType?: AuthenticationType): Promise<AWS.Credentials> {
        if (authType === undefined) {
            authType = await KinesisLoggingConfig.credentialRetrieval();
        }
        switch (authType) {
            case AuthenticationType.config:
                return await getConfigCreds();
            case AuthenticationType.credsfile:
                return await getFileCreds();
            case AuthenticationType.instance:
            default:
                return await getInstanceCreds();
        }
    }

    async function getConfigCreds(): Promise<AWS.Credentials> {
        let accessKey = await KinesisLoggingConfig.accessKey();
        let secretAccessKey = await KinesisLoggingConfig.secretAccessKey();
        let sessionToken = await KinesisLoggingConfig.sessionToken();
        if (sessionToken) {
            // using temporary credentials
            return new AWS.Credentials(accessKey, secretAccessKey, sessionToken);
        } else {
            // using permanent IAM User access key
            return new AWS.Credentials(accessKey, secretAccessKey);
        }
    }

    async function getInstanceCreds(): Promise<AWS.Credentials> {
        return new AWS.EC2MetadataCredentials({
            httpOptions: { timeout: 5000 }, // 5 second timeout
            maxRetries: 10, // retry 10 times
        });
    }

    async function getFileCreds(): Promise<AWS.Credentials> {
        return new Promise((resolve, reject) => {
            AWS.config.getCredentials((err) => {
                if (err) {
                    this.logger.error(err.toString());
                    reject(err);
                }
                resolve(new AWS.Credentials(AWS.config.credentials.accessKeyId, AWS.config.credentials.secretAccessKey, AWS.config.credentials.sessionToken));
            });
        });
    }
}