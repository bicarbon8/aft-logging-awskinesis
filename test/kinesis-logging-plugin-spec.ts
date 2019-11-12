import { KinesisLoggingPlugin } from "../src/kinesis-logging-plugin";
import { TestLogLevel, RandomGenerator, TestResult, MachineInfo, TestStatus } from "aft-core";
import { PutRecordInput } from "aws-sdk/clients/firehose";
import { KinesisMetaData } from "../src/kinesis-metadata";
import pkg = require('../package.json');

describe('KinesisLoggingPlugin', () => {
    it('only keeps the last 10 log lines', async () => {
        let plugin: KinesisLoggingPlugin = new KinesisLoggingPlugin();
        spyOn(plugin, 'enabled').and.returnValue(Promise.resolve(true));
        spyOn(plugin, 'level').and.returnValue(Promise.resolve(TestLogLevel.info));

        let expectedLogs: string[] = [];
        for (var i=0; i<20; i++) {
            let logMessage: string = RandomGenerator.getString(99, true, true);
            await plugin.log(TestLogLevel.warn, logMessage);
            expectedLogs.push(logMessage + '\n');
        }

        let actualLogs: string[] = plugin.getLogs();

        for (var i=0; i<actualLogs.length; i++) {
            expect(actualLogs[i]).toEqual(expectedLogs[i + 10]);
        }
    });

    it('keeps the last logged message with up to 500 characters', async () => {
        let plugin: KinesisLoggingPlugin = new KinesisLoggingPlugin();
        spyOn(plugin, 'enabled').and.returnValue(Promise.resolve(true));
        spyOn(plugin, 'level').and.returnValue(Promise.resolve(TestLogLevel.info));

        let logMessage: string = RandomGenerator.getString(500, true, true);
        await plugin.log(TestLogLevel.warn, logMessage);

        expect(plugin.getLastMessage()).toEqual(logMessage);

        logMessage = RandomGenerator.getString(500, true, true);
        await plugin.log(TestLogLevel.warn, logMessage);

        expect(plugin.getLastMessage()).toEqual(logMessage);

        logMessage = RandomGenerator.getString(500, true, true);
        await plugin.log(TestLogLevel.warn, logMessage);

        expect(plugin.getLastMessage()).toEqual(logMessage);
    });

    it('adds expected MetaData to the result', async () => {
        let plugin: KinesisLoggingPlugin = new KinesisLoggingPlugin();
        spyOn(plugin, 'enabled').and.returnValue(Promise.resolve(true));
        spyOn(plugin, 'level').and.returnValue(Promise.resolve(TestLogLevel.info));
        let putRecordSpy = spyOn<any>(plugin, 'putRecordAsync').and.callFake((client: AWS.Firehose, recordParams: PutRecordInput): Promise<any> => {
            TestStore.set('recordParams', recordParams);
            return;
        });

        let result: TestResult = new TestResult();
        result.TestId = 'C' + RandomGenerator.getInt(100, 9999);
        result.ResultMessage = RandomGenerator.getString(100);
        result.TestStatus = TestStatus.Skipped;
        let message: string = RandomGenerator.getString(250);
        process.env.JOB_NAME = RandomGenerator.getString(10);
        process.env.BUILD_NUMBER = RandomGenerator.getInt(100, 9999).toString();

        await plugin.log(TestLogLevel.info, message);
        await plugin.logResult(result);

        let recordParams: PutRecordInput = TestStore.get('recordParams');
        expect(recordParams).not.toBeNull();
        expect(recordParams).not.toBeUndefined();
        expect(recordParams.Record).not.toBeNull();
        expect(recordParams.Record.Data).not.toBeNull();
        let dataStr: string = recordParams.Record.Data.toString();
        let etr: TestResult = JSON.parse(dataStr);
        expect(etr.TestId).toEqual(result.TestId);
        expect(etr.TestStatus).toEqual(TestStatus.Skipped);
        expect(etr.MetaData).not.toBeNull();
        expect(etr.MetaData[KinesisMetaData[KinesisMetaData.Logs]]).not.toBeNull();
        expect(etr.MetaData[KinesisMetaData[KinesisMetaData.LastMessage]]).toEqual(message);
        expect(etr.MetaData[KinesisMetaData[KinesisMetaData.Version]]).toEqual(pkg.version);
        expect(etr.MetaData[KinesisMetaData[KinesisMetaData.JobName]]).toEqual(process.env.JOB_NAME);
        expect(etr.MetaData[KinesisMetaData[KinesisMetaData.BuildNumber]]).toEqual(process.env.BUILD_NUMBER);
        let mi: MI = etr.MetaData[KinesisMetaData[KinesisMetaData.MachineInfo]];
        expect(mi).not.toBeUndefined();
        expect(mi.name).not.toBeUndefined();
        expect(mi.name).toEqual(await MachineInfo.name());
    });

    /**
     * NOTE: this test sends an actual message to the Kinesis logger
     * only for use in debugging issues locally
     */
    fit('can send ExternalTestResult', async () => {
        let plugin: KinesisLoggingPlugin = new KinesisLoggingPlugin();
        spyOn(plugin, 'enabled').and.returnValue(Promise.resolve(true));
        spyOn(plugin, 'level').and.returnValue(Promise.resolve(TestLogLevel.info));

        let result: TestResult = new TestResult();
        result.TestId = 'C' + RandomGenerator.getInt(100, 9999);
        result.ResultMessage = RandomGenerator.getString(100);
        result.TestStatus = TestStatus.Skipped;
        let message: string = RandomGenerator.getString(250);
        process.env.JOB_NAME = RandomGenerator.getString(10);
        process.env.BUILD_NUMBER = RandomGenerator.getInt(100, 9999).toString();

        await plugin.log(TestLogLevel.info, message);
        await plugin.logResult(result);
    });
});

module TestStore {
    var _store: Map<string, any> = new Map<string, any>();
    export function set(key: string, val: any): void {
        _store.set(key, val);
    }
    export function get(key: string): any {
        return _store.get(key);
    }
}

class MI {
    name: string;
}