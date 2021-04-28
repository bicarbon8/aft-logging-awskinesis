import { AbstractLoggingPlugin, LoggingLevel, ITestResult, MachineInfo, BuildInfoPluginManager, ILoggingPluginOptions } from "../../aft-core/src";
import { Firehose } from "aws-sdk";
import pkg = require('../package.json');
import { nameof } from "ts-simple-nameof";
import AWS = require("aws-sdk");
import { kinesisConf, KinesisConfig } from "./configuration/kinesis-config";
import { KinesisLogRecord } from "./kinesis-log-record";

export interface IKinesisLoggingPluginOptions extends ILoggingPluginOptions {
    /**
     * indicates if log records should be sent in batches (defaults to true)
     */
    batch?: boolean;
    /**
     * the maximum size of records to batch before sending (defaults to 10)
     */
    batchSize?: number;
    
    /**
     * provided for testing purposes. not for normal use
     */
    _client?: AWS.Firehose;
    /**
     * provided for testing purposes. not for normal use
     */
    _config?: KinesisConfig;
    /**
     * provided for testing purposes. not for normal use
     */
    _buildInfoMgr?: BuildInfoPluginManager;
}

/**
 * NOTE: this plugin references configuration from the `aftconfig.json` file
 * under a name of `kinesisloggingplugin`. Ex:
 * ```json
 * {
 *   "kinesisloggingplugin": {
 *     "level": "info",
 *     "batch": true,
 *     "batchSize": 10
 *   }
 * }
 * ```
 */
export class KinesisLoggingPlugin extends AbstractLoggingPlugin {
    private _logs: Firehose.Record[];
    private _batch: boolean;
    private _batchSize: number;
    private _client: AWS.Firehose;
    private _config: KinesisConfig;
    private _buildInfoMgr: BuildInfoPluginManager;
    
    constructor(options?: IKinesisLoggingPluginOptions) {
        super(nameof(KinesisLoggingPlugin).toLowerCase(), options);
        this._client = options?._client;
        this._config = options?._config || kinesisConf;
        this._buildInfoMgr = options?._buildInfoMgr || BuildInfoPluginManager.instance();
        this._logs = [];
    }

    async onLoad(): Promise<void> {
        if (await this.enabled()) {
            // preload client
            await this.client();
        }
    }

    async client(): Promise<AWS.Firehose> {
        if (!this._client) {
            this._client = new Firehose({
                region: await this._config.region(),
                credentials: await this._config.credentials()
            });
        }
        return this._client;
    }

    async batch(): Promise<boolean> {
        if (this._batch === undefined) {
            this._batch = await this.optionsMgr.getOption(nameof<IKinesisLoggingPluginOptions>(o => o.batch), true);
        }
        return this._batch;
    }

    async batchSize(): Promise<number> {
        if (this._batchSize === undefined) {
            this._batchSize = await this.optionsMgr.getOption(nameof<IKinesisLoggingPluginOptions>(o => o.batchSize), 10);
        }
        return this._batchSize;
    }

    async log(level: LoggingLevel, message: string): Promise<void> {
        if (await this.enabled()) {
            let l: LoggingLevel = await this.level();
            if (level.value >= l.value && level != LoggingLevel.none) {
                let record: Firehose.Record = this._createKinesisLogRecord({
                    logName: await this.logName(),
                    level: level.name,
                    message: message,
                    version: pkg.version,
                    buildName: await this._buildInfoMgr.getBuildName(),
                    machineInfo: await MachineInfo.get()
                });
                this._logs.push(record);
                await this._checkAndSendLogs();
            }
        }
    }

    async logResult(result: ITestResult): Promise<void> {
        if (await this.enabled()) {
            let record: Firehose.Record = this._createKinesisLogRecord({
                logName: await this.logName(),
                result: result,
                version: pkg.version,
                buildName: await this._buildInfoMgr.getBuildName(),
                machineInfo: await MachineInfo.get()
            });
            this._logs.push(record);
            await this._checkAndSendLogs();
        }
    }

    async dispose(error?: Error): Promise<void> {
        if (await this.enabled()) {
            // ensure all remaining logs are sent
            this._batch = true;
            this._batchSize = 1;
            await this._checkAndSendLogs();
        }
    }

    private _createKinesisLogRecord(logRecord: KinesisLogRecord): Firehose.Record {
        let data: string = JSON.stringify(logRecord);
        let record: Firehose.Record = {
            Data: data
        };
        return record;
    }

    private async _checkAndSendLogs(): Promise<Firehose.PutRecordBatchOutput | Firehose.PutRecordOutput> {
        let batch: boolean = await this.batch();
        let batchSize: number = await this.batchSize();
        if (!batch || this._logs.length >= batchSize) {
            let data: Firehose.PutRecordBatchOutput | Firehose.PutRecordOutput;
            let deliveryStream: string = await this._config.deliveryStream();
            if (await this.batch()) {
                data = await this._sendBatch(deliveryStream, this._logs);
            } else {
                data = await this._send(deliveryStream, this._logs[0]);
            }
            this._logs = [];
            return data;
        }
        return null;
    }

    private async _sendBatch(deliveryStream: string, records: Firehose.Record[]): Promise<Firehose.PutRecordBatchOutput> {
        return await new Promise((resolve, reject) => {
            try {
                let batchInput: Firehose.PutRecordBatchInput = {
                    Records: records,
                    DeliveryStreamName: deliveryStream
                };
                this._client.putRecordBatch(batchInput, (err: AWS.AWSError, data: Firehose.PutRecordBatchOutput) => {
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

    private async _send(deliveryStream: string, record: Firehose.Record): Promise<Firehose.PutRecordOutput> {
        return await new Promise((resolve, reject) => {
            try {
                let input: Firehose.PutRecordInput = {
                    Record: record,
                    DeliveryStreamName: deliveryStream
                }
                this._client.putRecord(input, (err: AWS.AWSError, data: Firehose.PutRecordOutput) => {
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
}