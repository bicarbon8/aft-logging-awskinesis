import { nameof } from "ts-simple-nameof";
import { OptionsManager } from "aft-core";
import { AuthenticationType } from "./authentication-type";
import AWS = require("aws-sdk");

export interface IKinesisConfigOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    authenticationType?: string;
    region?: string;
    deliveryStream?: string;
}

/**
 * reads configuration from either the passed in {IKinesisConfigOptions}
 * or the `aftconfig.json` file under a heading of `kinesisconfig` like:
 * ```json
 * {
 *   "kinesisconfig": {
 *     "accessKeyId": "your-aws-access-key-id",
 *     "secretAccessKey": "your-aws-secret-access-key",
 *     "sessionToken": "your-aws-session-token",
 *     "authenticationType": "config",
 *     "region": "us-west-1",
 *     "deliveryStream": "your-frehose-delivery-stream"
 *   }
 * }
 * ```
 * NOTE:
 * * `authenticationType` can be a value of `instance`, `config` or `credsFile`
 * * `accessKeyId`, `secretAccessKey` and `sessionToken` are only used if `authenticationType` is set to `config`
 */
export class KinesisConfig {
    private _accessKeyId: string;
    private _secretAccessKey: string;
    private _sessionToken: string;
    private _authenticationType: AuthenticationType;
    private _region: string;
    private _deliveryStream: string;
    private _credentials: AWS.Credentials;
    private _optMgr: OptionsManager;

    constructor(options?: IKinesisConfigOptions) {
        this._optMgr = new OptionsManager(nameof(KinesisConfig).toLowerCase(), options);
    }

    async accessKeyId(): Promise<string> {
        if (!this._accessKeyId) {
            this._accessKeyId = await this._optMgr.getOption(nameof<IKinesisConfigOptions>(p => p.accessKeyId));
        }
        return this._accessKeyId;
    }
    async secretAccessKey(): Promise<string> {
        if (!this._secretAccessKey) {
            this._secretAccessKey = await this._optMgr.getOption(nameof<IKinesisConfigOptions>(p => p.secretAccessKey));
        }
        return this._secretAccessKey;
    }
    async sessionToken(): Promise<string> {
        if (!this._sessionToken) {
            this._sessionToken = await this._optMgr.getOption(nameof<IKinesisConfigOptions>(p => p.sessionToken));
        }
        return this._sessionToken;
    }
    async authType(): Promise<AuthenticationType> {
        if (!this._authenticationType) {
            let t: string = await this._optMgr.getOption(nameof<IKinesisConfigOptions>(p => p.authenticationType), AuthenticationType[AuthenticationType.instance]);
            this._authenticationType = AuthenticationType[t];
        }
        return this._authenticationType;
    }
    async region(): Promise<string> {
        if (!this._region) {
            this._region = await this._optMgr.getOption(nameof<IKinesisConfigOptions>(p => p.region));
        }
        return this._region;
    }
    async deliveryStream(): Promise<string> {
        if (!this._deliveryStream) {
            this._deliveryStream = await this._optMgr.getOption(nameof<IKinesisConfigOptions>(p => p.deliveryStream));
        }
        return this._deliveryStream;
    }
    async credentials(): Promise<AWS.Credentials> {
        if (!this._credentials) {
            switch (await this.authType()) {
                case AuthenticationType.config:
                    this._credentials = await this._getConfigCreds();
                    break;
                case AuthenticationType.credsfile:
                    this._credentials = await this._getFileCreds();
                    break;
                case AuthenticationType.instance:
                default:
                    this._credentials = await this._getInstanceCreds();
                    break;
            }
        }
        return this._credentials;
    }

    private async _getConfigCreds(): Promise<AWS.Credentials> {
        let accessKey = await this.accessKeyId();
        let secretAccessKey = await this.secretAccessKey();
        let sessionToken = await this.sessionToken();
        if (sessionToken) {
            // using temporary credentials
            return new AWS.Credentials(accessKey, secretAccessKey, sessionToken);
        } else {
            // using permanent IAM User access key
            return new AWS.Credentials(accessKey, secretAccessKey);
        }
    }

    private async _getInstanceCreds(): Promise<AWS.Credentials> {
        let ec2Meta: AWS.EC2MetadataCredentials = new AWS.EC2MetadataCredentials({
            httpOptions: { timeout: 5000 }, // 5 second timeout
            maxRetries: 10, // retry 10 times
        });
        return await new Promise((resolve, reject) => {
            try {
                ec2Meta.get((err: AWS.AWSError) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(new AWS.Credentials(ec2Meta.accessKeyId, ec2Meta.secretAccessKey, ec2Meta.sessionToken));
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    private async _getFileCreds(): Promise<AWS.Credentials> {
        return new Promise((resolve, reject) => {
            try {
                AWS.config.getCredentials((err) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(new AWS.Credentials(AWS.config.credentials.accessKeyId, AWS.config.credentials.secretAccessKey, AWS.config.credentials.sessionToken));
                });
            } catch (e) {
                reject(e);
            }
        });
    }
}

export const kinesisConf = new KinesisConfig();