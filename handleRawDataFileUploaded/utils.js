const {Storage} = require('@google-cloud/storage');
const {BigQuery} = require('@google-cloud/bigquery');
const { google } = require('googleapis');
const dataflow = google.dataflow('v1b3');
const storage = new Storage();
const constants = require('./constants');
const TAG = "handleRawDataFileUploaded";

module.exports = {
    getGoogleAuthClient,
    checkSchemaUdfFileExist,
    createDataflowJob
}

/* Google認証情報の取得 */
async function getGoogleAuthClient() {
    try {
        let client = await google.auth.getClient({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        return client;
    } catch(err) {
        console.error(`%s: ERROR(%s)`, TAG, err);
    }
}

/* スキーマファイルとUDFファイルの存在確認
    * schema/<table_name>_schema.json
    * udf/<table_name>_.js
    */
async function checkSchemaUdfFileExist(datasetName, tableName) {
    const bucket = storage.bucket(constants.BUCKET_NAME);
    try {
        const fileSchema = bucket.file(`${datasetName}/schema/${tableName}_schema.json`);
        const fileUdf = bucket.file(`${datasetName}/udf/${tableName}_udf.js`);
        const [hasSchema] = await fileSchema.exists();
        const [hasUdf] = await fileUdf.exists();
        if(hasSchema && hasUdf) {
            return true;
        } else {
            return false;
        }
    } catch(err) {
        console.error(`%s: ERROR(%s)`, TAG, err);
    }
}

/* Google Dataflow ジョブの作成 */
async function createDataflowJob(client, datasetName, fileName, tableName, fileExtension, fileNameWithoutExtension) {
    let date = new Date();
    let time = date.getHours() + "h" + date.getMinutes() + "m" + date.getSeconds() + "s" + date.getMilliseconds();
    let request = {
        auth: client,
        projectId: constants.PROJECT_ID,
        requestBody: {
            jobName: "etl-json-to-bigquery-" + time,
            parameters: {
                inputFilePattern: `gs://${constants.BUCKET_NAME}/${datasetName}/raw/${fileName}`,
                javascriptTextTransformFunctionName: "transformJSON",
                JSONPath: `gs://${constants.BUCKET_NAME}/${datasetName}/schema/${tableName}_schema.json`,
                javascriptTextTransformGcsPath: `gs://${constants.BUCKET_NAME}/${datasetName}/udf/${tableName}_udf.js`,
                outputTable:`${constants.PROJECT_ID}:${datasetName}.${fileNameWithoutExtension}`,
                bigQueryLoadingTemporaryDirectory: `gs://${constants.BUCKET_NAME}/${datasetName}/temp_dir/`,
            }
        },
        gcsPath: "gs://dataflow-templates/latest/GCS_Text_to_BigQuery"
    };

    if(fileExtension === '.csv') {
        request.requestBody.jobName = "etl-csv-to-bigquery-" + time;
        request.requestBody.parameters.javascriptTextTransformFunctionName = "transformCSV"
    }
    try {
        jobDataFlow = await dataflow.projects.templates.create(request);
        return jobDataFlow;
    } catch(err) {
        console.error(`%s: ERROR(%s)`, TAG, err);
    }
}