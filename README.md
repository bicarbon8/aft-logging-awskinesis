# AFT-Logging-AWSKinesis
provides logging to AWS Kinesis Firehose endpoint for any `TestResult` objects logged via the `aft-core.TestLog`

## Configuration
to send values to AWS Kinesis Firehose endpoints you must specify the AWS Credentials, the AWS Region Endpoint and the AWS Kinesis Delivery Stream. These take the following form in your `aftconfig.json`:
```json
{
    "kinesisfirehose_enabled": "true",
    "aws_access_key_id": "your-access-key-id",
    "aws_secret_access_key": "your-secret-access-key",
    "aws_session_token": "your-temporary-session-token",
    "kinesisfirehose_regionendpoint": "eu-west-1",
    "kinesisfirehose_deliverystream": "your-firehose-stream-name",
    "aws_credential_retrieval": "config"
}
```
- *kinesisfirehose_enabled* - setting to "true" will allow sending of `TestResult` objects to Kinesis Firehose
- *aws_access_key_id* - if using configuration based credentials, this should be set to your AWS IAM User's Access Key ID
- *aws_secret_access_key* - if using configuration based credentials, this should be set to your AWS IAM User's Secret Access Key
- *aws_session_token* - if using configuration based credentials and a temporary session, this should be set to your temporary session token
- *kinesisfirehose_regionendpoint* - the AWS region where the Kinesis Firehose stream is located. values like `eu-west-1` or `us-west-2` are expected.
- *kinesisfirehose_deliverystream* - the name of the Kinesis Firehose stream to send through. If using Elasticsearch as your back-end storage, this would be the Elasticsearch index to use.
- *aws_credential_retrieval* - the mechanism to be used to retrieve credentials. valid values are one of `config`, `instance` and `credsFile`
  - `config` - uses the `TestConfig` module to lookup values in either the _aftconfig.json_ or from the environment variables
  - `instance` - uses instance profile credentials from the machine which is only possible when running from within an AWS EC2 instance
  - `credsFile` - reads from the local user's credential file

#### NOTE: any of the above configuration keys and values may be set as environment variables instead of within the `aftconfig.json`

## Format of logged TestResult
the `TestResult` that is logged to your AWS Kinesis Firehose endpoint will have the following format:
```JSON
{
    "TestStatus": 4, 
    "ResultId": "78be40fc-5cb6-4da6-b3d8-e9ea5a97f022", 
    "Created": "2019-11-06T10:59:01.405Z", 
    "Issues": [], 
    "MetaData.Logs": "max of 100 characters per message\nand max of last 10 messages", 
    "MetaData.LastMessage": "full message text from last message logged", 
    "MetaData.Version": "1.0.0", 
    "MetaData.JobName": "if available", 
    "MetaData.BuildNumber": "8345", 
    "MetaData.TestRunId": "userName_machineName_mm/dd/yyyy", 
    "MetaData.MachineInfo.ip": "xxx.xxx.xxx.xxx", 
    "MetaData.MachineInfo.user": "userName", 
    "MetaData.MachineInfo.name": "machineName",
    "MetaData.DurationMs": "23074",
    "MetaData.TestStatusStr": "Failed",
    "MetaData.ExceptionsStr": "max of 100 characters per exception\nand no limit to number of exceptions\n",
    "MetaData.LastException.Type": "Error type name",
    "MetaData.LastException.Message": "Error message text",
    "MetaData.LastException.StackTrace": "Error stack trace text",
    "TestId": "C4782", 
    "ResultMessage": "full result message" 
}
```