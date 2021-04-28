# AFT-Logging-AWSKinesis
an Automated Functional Testing (AFT) library providing logging to an AWS Kinesis Firehose endpoint for any `TestResult` objects logged via the `aft-core.LoggingPluginManager`

## Installation
`> npm i aft-logging-awskinesis`

## Configuration
to send values to AWS Kinesis Firehose endpoints you must specify the AWS Credentials, the AWS Region Endpoint and the AWS Kinesis Delivery Stream. These take the following form in your `aftconfig.json`:
```json
{
  "loggingpluginmanager": {
    "pluginNames": ["kinesis-logging-plugin"]
  },
  "kinesisconfig": {
    "accessKeyId": "your-aws-access-key-id",
    "secretAccessKey": "your-aws-secret-access-key",
    "sessionToken": "your-aws-session-token",
    "authenticationType": "config",
    "region": "us-west-1",
    "deliveryStream": "your-frehose-delivery-stream"
  },
  "kinesisloggingplugin": {
    "level": "info",
    "batch": false,
    "batchSize": 1
  }
}
```
- **kinesisconfig** - the configuration section used by this Plugin for authenticating with AWS and specifying the Kinesis Firehose details
  - **accessKeyId** - a `string` containing your AWS IAM user's Access Key ID. required if `authenticationType` is set to `config`
  - **secretAccessKey** - a `string` containing your AWS IAM user's Secret Access Key. required if `authenticationType` is set to `config`
  - **sessionToken** - a `string` containing your AWS IAM user's Session Token. required if `authenticationType` is set to `config` and if you are using a temporary session
  - **authenticationType** - a `string` containing either `config`, `instance`, or `credsFile` indicating how the credentials should be retrieved for connecting to your Kinesis Firehose instance
    - `config` - uses the values specified in `accessKeyId`, `secretAccessKey` and optionally `sessionToken`
    - `instance` - uses instance profile credentials from the machine which is only possible when running from within an AWS EC2 instance
    - `credsFile` - reads from the local user's credential file
  - **region** - a `string` containing the AWS region where the Kinesis Firehose stream is located. values like `eu-west-1` or `us-west-2` are expected.
  - **deliveryStream** - a `string` containing the name of the Kinesis Firehose stream to send through. If using Elasticsearch as your back-end storage, this would be the Elasticsearch index to use.
- **kinesisloggingplugin** - the configuration section used by this Plugin for setting logging specific details
  - **level** - a `string` containing the `aft-core.LoggingLevel` to be used in capturing logs
  - **batch** - a `boolean` indicating whether logs should be batched before forwarding to Kinesis Firehose _(defaults to `true`)_
  - **batchSize** - a `number` representing the number of log records to batch before sending _(defaults to 10)_

> NOTE: any of the above configuration values may be set to read from environment variables by setting their value to the name of the environment variable surrounded by `%` like `"accessKeyId": "%AWS_ACCESS_KEY_ID%"` which would read from an environment variable named `AWS_ACCESS_KEY_ID`

## Format of log records
the log record that is sent to your AWS Kinesis Firehose endpoint will have the following format:
### message logs
```JSON
{
    "logName": "if used with TestWrapper this will be the 'description' or a GUID",
    "message": "this is the actual message being logged", 
    "level": "warn", 
    "version": "3.0.0", 
    "buildName": "Jenkins or Team City Job Name", 
    "buildNumber": "Jenkins or Team City Job Number", 
    "machineInfo": {
      "ip": "234.9.10.11",
      "name": "CETH-ARG-WIN10",
      "user": "SYSTEM"
    }
}
```
- **logName** - the `logName` passed to this plugin when loaded from the `LoggingPluginManager`
- **message** - the `string` being logged by some component
- **level** - a `string` value from one of the `aft-core.LoggingLevel` values based on the level of the message being logged
- **version** - the current version of the `KinesisLoggingPlugin`
- **buildName** - a `string` retrieved from the `BuildInfoPluginManager.getBuildName` function
- **buildNumber** - a `string` retrieved from the `BuildInfoPluginManager.getBuildNumber` function
- **machineInfo** - an `aft-core.MachineInfoData` object containing the following:
  - **ip** - a `string` of the machine's IP address
  - **name** - a `string` of the machine's name
  - **user** - a `string` of the currently logged in user who executed the tests
### `ITestResult` logs
```JSON
{
    "logName": "if used with TestWrapper this will be the 'description' or a GUID",
    "result": {
      "testId": "1234",
      "resultMessage": "the final result was a SUCCESS!",
      "status": 1,
      "resultId": "dbbf6fce-14db-4bd2-ba31-e3fa68d719e4",
      "created": "Wed Apr 28 2021 16:02:43 GMT+0100 (Irish Standard Time)",
      "defects": [
        {
          "id": "3344",
          "title": "a defect that has now been closed",
          "description": "this defect used to affect this test, but now it doesn't :)",
          "status": 1
        }
      ],
      "metadata": {}
    }, 
    "buildName": "Jenkins or Team City Job Name", 
    "buildNumber": "Jenkins or Team City Job Number", 
    "machineInfo": {
      "ip": "234.9.10.11",
      "name": "CETH-ARG-WIN10",
      "user": "SYSTEM"
    }
}
```
- **logName** - the `logName` passed to this plugin when loaded from the `LoggingPluginManager`
- **result** - an `ITestResult` object containing the following:
  - **testId** - a `string` containing any unique ID for the test result being recorded
  - **resultMessage** - a `string` message of the final result
  - **status** - a `number` representing the `aft-core.TestStatus` enum value
  - **resultId** - a `string` containing a unique identifier for the `ITestResult`
  - **created** - a `string` containing the date and time the `ITestResult` was created
  - **defects** - an array of `aft-core.IDefect` objects
  - **metadata** - an `object` that can contain additional data for the `ITestResult`
- **version** - the current version of the `KinesisLoggingPlugin`
- **buildName** - a `string` retrieved from the `BuildInfoPluginManager.getBuildName` function
- **buildNumber** - a `string` retrieved from the `BuildInfoPluginManager.getBuildNumber` function
- **machineInfo** - an `aft-core.MachineInfoData` object containing the following:
  - **ip** - a `string` of the machine's IP address
  - **name** - a `string` of the machine's name
  - **user** - a `string` of the currently logged in user who executed the tests