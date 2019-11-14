import { ILoggingPlugin, TestLogLevel, TestResult, TestLog, TestLogOptions, EllipsisLocation, MachineInfo, BuildInfo } from "aft-core";
import { Firehose } from "aws-sdk";
import { Authentication } from "./aws-credentials/authentication";
import { PutRecordInput } from "aws-sdk/clients/firehose";
import 'aft-core/dist/src/extensions/string-extensions';
import { KinesisMetaData } from "./kinesis-metadata";
import pkg = require('../package.json');
import { KinesisLoggingConfig } from "./configuration/kinesis-logging-config";

@ILoggingPlugin.register
export class KinesisLoggingPlugin implements ILoggingPlugin {
    name: string = 'kinesis';
    
    private logs: string[] = [];
    private maxLogLines: number = 10;
    private lastMessage: string;

    constructor() {
        this.consoleLog("creating logging plugin instance.");
    }
    
    private client: AWS.Firehose;
    private async getClient(): Promise<AWS.Firehose> {
        if (!this.client) {
            this.client = new Firehose({
                region: await KinesisLoggingConfig.getRegion(),
                credentials: await Authentication.get()
            });
        }
        return this.client;
    }

    async level(): Promise<TestLogLevel> {
        let lvl: TestLogLevel = await TestLogOptions.level();
        return lvl;
    }

    getLogs(): string[] {
        return this.logs;
    }

    getLastMessage(): string {
        return this.lastMessage;
    }
    
    async enabled(): Promise<boolean> {
        return await KinesisLoggingConfig.enabled();
    }

    async log(level: TestLogLevel, message: string): Promise<void> {
        let enabled: boolean = await this.enabled();
        if (enabled) {
            let l: TestLogLevel = await this.level();
            if (level.value >= l.value && level != TestLogLevel.trace) {
                this.lastMessage = message.ellide(500, EllipsisLocation.end);
                this.logs.push(message.ellide(99, EllipsisLocation.end) + '\n');
                if (this.logs.length > this.maxLogLines) {
                    // trim off the oldest entry
                    this.logs.shift();
                }
            }
        }
    }

    async logResult(result: TestResult): Promise<void> {
        let enabled: boolean = await this.enabled();
        if (enabled) {
            result = await this.updateResultMetaData(result);
            let data: string = JSON.stringify(result);
            var recordParams: PutRecordInput = {
                Record: {
                    Data: data
                },
                DeliveryStreamName: await KinesisLoggingConfig.getDeliveryStreamName()
            };
            this.consoleLog("sending TestResult: '" + result.TestId + "' to Kinesis Firehose endpoint using ResultId: '" + result.ResultId + "'...");
            await this.putRecordAsync(await this.getClient(), recordParams);
            this.consoleLog("TestResult: '" + result.TestId + "' sent to Kinesis Firehose endpoint.");
        }
    }

    private async updateResultMetaData(result: TestResult): Promise<TestResult> {
        if (result) {
            let logLines: string = '';
            let logs: string[] = this.getLogs();
            for (var i=(logs.length-1); i>=0; i--) {
                logLines += logs[i];
            }
            result.MetaData[KinesisMetaData[KinesisMetaData.Logs]] = logLines;
            result.MetaData[KinesisMetaData[KinesisMetaData.LastMessage]] = this.getLastMessage();
            result.MetaData[KinesisMetaData[KinesisMetaData.Version]] = pkg.version;
            result.MetaData[KinesisMetaData[KinesisMetaData.JobName]] = await BuildInfo.name();
            result.MetaData[KinesisMetaData[KinesisMetaData.BuildNumber]] = await BuildInfo.number();
            let mi = {
                name: await MachineInfo.name(),
                user: await MachineInfo.user(),
                ip: await MachineInfo.ip()
            };
            result.MetaData[KinesisMetaData[KinesisMetaData.TestRunId]] = mi.user + '_' + mi.name + '_' + this.formattedDate();
            result.MetaData[KinesisMetaData[KinesisMetaData.MachineInfo]] = mi;
        }
        return result;
    }

    private formattedDate(): string {
        let now: Date = new Date();
        return now.toLocaleDateString('en-IE', { timeZone: 'UTC' });
    }

    private async consoleLog(message: string): Promise<void> {
        let level: TestLogLevel = await this.level();
        if (level.value <= TestLogLevel.trace.value && level != TestLogLevel.none) {
            console.log(TestLog.format(this.name, TestLogLevel.trace, message));
        }
    }

    private async putRecordAsync(client: AWS.Firehose, recordParams: PutRecordInput): Promise<any> {
        return await new Promise((resolve, reject) => {
            try {
                client.putRecord(recordParams, (err: AWS.AWSError, data: Firehose.PutRecordOutput) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(data);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    async finalise(): Promise<void> {
        // TODO: track completion of 'putRecord' call using callback Promise.resolve
    }
}