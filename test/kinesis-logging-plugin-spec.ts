import { KinesisLoggingPlugin } from "../src/kinesis-logging-plugin";
import { MachineInfo, TestStatus, LoggingLevel, rand, ITestResult } from "aft-core";
import pkg = require('../package.json');
import Firehose = require("aws-sdk/clients/firehose");
import { KinesisConfig } from "../src/configuration/kinesis-config";
import { KinesisLogRecord } from "../src/kinesis-log-record";

describe('KinesisLoggingPlugin', () => {
    it('can batch messages for sending', async () => {
        let plugin: KinesisLoggingPlugin = new KinesisLoggingPlugin({
            enabled: true,
            level: LoggingLevel.info.name,
            batch: true,
            batchSize: 10
        });
        let spyCheckAndSendLogs = spyOn<any>(plugin, '_checkAndSendLogs').and.callThrough();
        let spySendBatch = spyOn<any>(plugin, '_sendBatch').and.callFake((deliveryStream: string, records: Firehose.Record[]) => {
            /* do nothing */
        });
        let spySend = spyOn<any>(plugin, '_send').and.callFake((deliveryStream: string, record: Firehose.Record) => {
            /* do nothing */
        });

        for (var i=0; i<20; i++) {
            let logMessage: string = rand.getString(99, true, true);
            await plugin.log(LoggingLevel.warn, logMessage);
        }

        expect(spyCheckAndSendLogs).toHaveBeenCalledTimes(20);
        expect(spySendBatch).toHaveBeenCalledTimes(2);
        expect(spySend).toHaveBeenCalledTimes(0);
    });

    it('can disable batch sending of messages', async () => {
        let plugin: KinesisLoggingPlugin = new KinesisLoggingPlugin({
            enabled: true,
            level: LoggingLevel.info.name,
            batch: false,
            batchSize: 10
        });
        let spyCheckAndSendLogs = spyOn<any>(plugin, '_checkAndSendLogs').and.callThrough();
        let spySendBatch = spyOn<any>(plugin, '_sendBatch').and.callFake((deliveryStream: string, records: Firehose.Record[]) => {
            /* do nothing */
        });
        let spySend = spyOn<any>(plugin, '_send').and.callFake((deliveryStream: string, record: Firehose.Record) => {
            /* do nothing */
        });

        for (var i=0; i<20; i++) {
            let logMessage: string = rand.getString(99, true, true);
            await plugin.log(LoggingLevel.warn, logMessage);
        }

        expect(spyCheckAndSendLogs).toHaveBeenCalledTimes(20);
        expect(spySendBatch).toHaveBeenCalledTimes(0);
        expect(spySend).toHaveBeenCalledTimes(20);
    });

    it('sends any unsent batched logs on dispose', async () => {
        let plugin: KinesisLoggingPlugin = new KinesisLoggingPlugin({
            enabled: true,
            level: LoggingLevel.info.name,
            batch: true,
            batchSize: 10
        });
        let spyCheckAndSendLogs = spyOn<any>(plugin, '_checkAndSendLogs').and.callThrough();
        let spySendBatch = spyOn<any>(plugin, '_sendBatch').and.callFake((deliveryStream: string, records: Firehose.Record[]) => {
            /* do nothing */
        });
        let spySend = spyOn<any>(plugin, '_send').and.callFake((deliveryStream: string, record: Firehose.Record) => {
            /* do nothing */
        });

        for (var i=0; i<9; i++) {
            let logMessage: string = rand.getString(99, true, true);
            await plugin.log(LoggingLevel.warn, logMessage);
        }

        expect(spyCheckAndSendLogs).toHaveBeenCalledTimes(9);
        expect(spySendBatch).toHaveBeenCalledTimes(0);
        expect(spySend).toHaveBeenCalledTimes(0);

        await plugin.dispose();

        expect(spySendBatch).toHaveBeenCalledTimes(1);
        expect(spySend).toHaveBeenCalledTimes(0);
    });

    it('only sends messages of the appropriate level', async () => {
        let plugin: KinesisLoggingPlugin = new KinesisLoggingPlugin({
            enabled: true,
            level: LoggingLevel.info.name,
            batch: false,
            batchSize: 10
        });
        let spyCheckAndSendLogs = spyOn<any>(plugin, '_checkAndSendLogs').and.callThrough();
        let spySendBatch = spyOn<any>(plugin, '_sendBatch').and.callFake((deliveryStream: string, records: Firehose.Record[]) => {
            /* do nothing */
        });
        let spySend = spyOn<any>(plugin, '_send').and.callFake((deliveryStream: string, record: Firehose.Record) => {
            /* do nothing */
        });

        await plugin.log(LoggingLevel.debug, rand.guid);
        await plugin.log(LoggingLevel.info, rand.guid);
        await plugin.log(LoggingLevel.warn, rand.guid);

        expect(spyCheckAndSendLogs).toHaveBeenCalledTimes(2);
        expect(spySendBatch).toHaveBeenCalledTimes(0);
        expect(spySend).toHaveBeenCalledTimes(2);
    });

    it('adds expected fields to the log record', async () => {
        let plugin: KinesisLoggingPlugin = new KinesisLoggingPlugin({
            logName: 'adds expected fields to the log record',
            enabled: true,
            level: LoggingLevel.info.name,
            batch: false,
            batchSize: 10
        });
        let spySend = spyOn<any>(plugin, '_send').and.callFake((deliveryStream: string, record: Firehose.Record) => {
            TestStore.set('_send', record);
        });

        let expectedMessage: string = rand.guid;
        await plugin.log(LoggingLevel.warn, expectedMessage);

        let logRecord: Firehose.Record = TestStore.get<Firehose.Record>('_send');
        let data: KinesisLogRecord = JSON.parse(logRecord.Data.toString()) as KinesisLogRecord;
        expect(data.level).toEqual(LoggingLevel.warn.name);
        expect(data.logName).toEqual('adds expected fields to the log record');
        expect(data.message).toEqual(expectedMessage);
        expect(data.machineInfo).toEqual(await MachineInfo.get());
        expect(data.result).toBeUndefined();
        expect(data.version).toEqual(pkg.version);
    });

    /**
     * WARNING: this test sends an actual message to the Kinesis logMgr
     * only for use in debugging issues locally
     */
    xit('can send real logs and ITestResult objects', async () => {
        let plugin: KinesisLoggingPlugin = new KinesisLoggingPlugin({
            logName: 'can send real logs and ITestResult objects',
            enabled: true,
            level: LoggingLevel.trace.name,
            batch: true,
            batchSize: 10,
            _config: new KinesisConfig({
                accessKeyId: '%AWS_ACCESS_KEY_ID%',
                secretAccessKey: '%AWS_SECRET_ACCESS_KEY%',
                sessionToken: '%AWS_SESSION_TOKEN',
                deliveryStream: '%kinesis_deliverystream%',
                region: '%AWS_REGION%'
            })
        });

        let result: ITestResult = {
            resultId: rand.guid,
            created: new Date(),
            testId: 'C' + rand.getInt(100, 9999),
            resultMessage: rand.getString(100),
            status: TestStatus.Skipped
        };
        let message: string = rand.getString(250);

        await plugin.log(LoggingLevel.info, message);
        await plugin.logResult(result);
        await plugin.dispose();
    });
});

module TestStore {
    var _store: Map<string, any> = new Map<string, any>();
    export function set(key: string, val: any): void {
        _store.set(key, val);
    }
    export function get<T>(key: string): T {
        return _store.get(key) as T;
    }
}