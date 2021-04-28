import { ITestResult, MachineInfoData } from "../../aft-core/src";

export interface KinesisLogRecord {
    logName?: string;
    message?: string;
    level?: string;
    result?: ITestResult;
    version?: string;
    buildName?: string;
    buildNumber?: string;
    machineInfo?: MachineInfoData;
}