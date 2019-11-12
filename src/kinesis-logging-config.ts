import { TestConfig } from "aft-core";
import { AuthenticationType } from "./authentication-type";

export module KinesisLoggingConfig {
    export var ENABLED_KEY = 'kinesisfirehose_enabled';
    export var ACCESSKEYID_KEY = 'aws_access_key_id';
    export var SECRETACCESSKEY_KEY = 'aws_secret_access_key';
    export var SESSIONTOKEN_KEY = 'aws_session_token';
    export var CREDENTIALRETRIEVAL_KEY = 'aws_credential_retrieval';
    export var REGIONENDPOINT_KEY = 'kinesisfirehose_regionendpoint';
    export var DELIVERYSTREAM_KEY = 'kinesisfirehose_deliverystream';

    export async function enabled(): Promise<boolean> {
        let enabledStr: string = await TestConfig.getValueOrDefault(ENABLED_KEY, 'false');
        if (enabledStr.toLocaleLowerCase() == 'true') {
            return true;
        }
        return false;
    }
    
    export async function accessKey(): Promise<string> {
        return await TestConfig.getValueOrDefault(ACCESSKEYID_KEY);
    }

    export async function secretAccessKey(): Promise<string> {
        return await TestConfig.getValueOrDefault(SECRETACCESSKEY_KEY);
    }

    export async function sessionToken(): Promise<string> {
        return await TestConfig.getValueOrDefault(SESSIONTOKEN_KEY);
    }

    export async function credentialRetrieval(): Promise<AuthenticationType> {
        let authTypeStr: string = await TestConfig.getValueOrDefault(CREDENTIALRETRIEVAL_KEY, 'config');
        return AuthenticationType[authTypeStr.toLocaleLowerCase()];
    }

    export async function getRegion(): Promise<string> {
        return await TestConfig.getValueOrDefault(REGIONENDPOINT_KEY);
    }

    export async function getDeliveryStreamName(): Promise<string> {
        return await TestConfig.getValueOrDefault(DELIVERYSTREAM_KEY);
    }
}