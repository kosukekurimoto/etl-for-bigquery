const utils = require('./utils');
const path = require('path');
const TAG = "handleRawDataFileUploaded";

/**
 * CloudStorageにファイルがアップロードされた時に呼ばれる
 */
module.exports = (event, context, callback) => {
    const targetFolder = "raw";
    const pathString = event.name; // ファイルパス(ファイル名含む)
    const pathSplit = pathString.split("/");
    
    console.info('%s: ファイルがアップロードされました。(%s)', TAG, pathString);

    /* アップロードされたファイルが第3階層直下でなかった場合はスキップ */
    if(pathSplit.length != 3) {
        callback();
        return;
    }

    /* アップロードされたファイルがrawフォルダ直下でなかった場合はスキップ */
    const parentFolder = pathSplit[pathSplit.length - 2];
    if(parentFolder != targetFolder) {
        callback();
        return;
    }

    /* アップロードされたファイルの拡張子が csv または json でなかった場合はスキップ */
    const fileExtension = path.extname(pathString);  // 拡張子
    if(fileExtension != '.csv' && fileExtension != '.json') {
        callback();
        return;
    }

    const fileName = path.basename(pathString);  // アップロードされたファイル名
    const fileNameWithoutExtension = path.parse(path.basename(pathString)).name;  // アップロードされたファイル名(拡張子なし)
    const datasetName = pathSplit[pathSplit.length - 3];  // ETL対象のBigQueryデータセット名
    const tableName = getTableName(fileNameWithoutExtension); // ETL対象のBigQueryテーブル名
    if(tableName == false){
        console.error('%s: アップロードされたファイルのテーブル名が不正です。', TAG);
        callback();
        return;
    }
    console.info('%s: filename(%s)', TAG, fileName);
    console.info('%s: file extension(%s)', TAG, fileExtension);
    console.info('%s: filename without extension(%s)', TAG, fileNameWithoutExtension);
    console.info('%s: dataset name(%s)', TAG, datasetName);
    console.info('%s: tablename(%s)', TAG, tableName);

    /* GCS→BigQueryへのデータ連携を開始 */
    loadDataFromGCSToBigQuery(callback, datasetName, tableName, fileName, fileExtension, fileNameWithoutExtension);
}

async function loadDataFromGCSToBigQuery(callback, datasetName, tableName, fileName, fileExtension, fileNameWithoutExtension){
    /* スキーマファイルとUDFファイルの存在確認 */
    if(await utils.checkSchemaUdfFileExist(datasetName, tableName) != true){
        console.error("%s: スキーマファイル schema/%s_schema.json UDFファイル udf/%s_udf.js が見つかりません。", TAG, tableName, tableName);
        callback();
        return;
    }
    try { 
        let client = await utils.getGoogleAuthClient(); 
        /* Google Dataflowにデータ連携ジョブを作成 */
        let job = await utils.createDataflowJob(client, datasetName, fileName, tableName, fileExtension, fileNameWithoutExtension);
        if(job) {
            console.info("%s: BigQueryへのインポートジョブの作成に成功しました。", TAG);
        }
        callback();
        return;
    } catch(err) {
        console.error(`%s: ERROR(%s)`, TAG, err);
        callback();
        return;
    }
}

/* ファイル名からテーブル名を取得 */
function getTableName(fileNameWithoutExtension) {
    let tableNameSplit = fileNameWithoutExtension.split('_'); // ファイル名を分割
    if(tableNameSplit.length >= 2) { // ファイル名にサフィックス(_名前)を含む場合
        if(checkDateTimeFormat(tableNameSplit[tableNameSplit.length - 1])) {  // 日付サフィックス(_YYYYMMDD)の場合
            tableNameSplit.pop(); // 日付サフィックスを(_YYYYMMDD)削除
            return tableNameSplit.join('_'); // 分割した名前を結合してテーブル名として返す
        } else {
            return fileNameWithoutExtension; // 日付サフィックスではないので、テーブル名として返す
        }
    } else { // サフィックスがない場合は名前をそのまま返す
        return fileNameWithoutExtension;
    }
}

/* テーブル名サフィックス(YYYYMMDD)のフォーマットチェック */
function checkDateTimeFormat(stringDateTime) {
    let regex = /^(19[5-9][0-9]|20[0-4][0-9]|2050)(0?[1-9]|1[0-2])(0?[1-9]|[12][0-9]|3[01])$/;
    return stringDateTime.match(regex);
}