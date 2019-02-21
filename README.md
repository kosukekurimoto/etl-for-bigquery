# etl-for-bigquery
CSV 、JSON 形式のデータを Google Cloud Platform のデータウェアハウス「BigQuery」に ETL「Extract・Transform・Load」する為の Cloud Functions です。

* ETLの流れ
```
1. BigQuery に連携したいデータ(CSV or JSON)を Cloud Storage にアップロード
2. Cloud Storage トリガーにより Cloud Functions が発火、Cloud Dataflow にジョブを作成
3. Cloud Dataflow がアップロードされたデータをルールに従って加工し、BigQuery に保存
```

# データ連携用の Cloud Storage バケット構成
```
<バケット名>/
    └── <データセット名>
        ├── raw/ // 連携したいデータのアップロード用ディレクトリ
        │   └── <テーブル名>_yyyymmdd.csv
        ├── schema/
        │   └── <テーブル名>_schema.json  // BigQuery テーブルのスキーマ定義ファイル
        └── udf/
            └── <テーブル名>_udf.json     // データ加工用 Javascript ファイル
```

# Quickstart
## 1. Google Cloud Platform の設定
### 1-1. [Google Platform プロジェクト](https://cloud.google.com/)の作成
プロジェクト ID を取得
### 1-2. [Cloud Storage](https://console.cloud.google.com/storage/browser) にデータアップロード用の Bucket を作成
バケット名の取得

## 2. データ連携の準備(サンプルデータ exampletable_20190201.csv を使った例)
### 2-1. BigQueryのデータセット名、テーブル名の決定
* データセット名: exampledataset
* テーブル名: exampletable

### 2-2. BigQuery データセットの作成
「2-1.」で決めた名前の通り、[BigQuery](https://console.cloud.google.com/bigquery) にデータセット「exampledataset」を作成する

### 2-3. exampledataset 用ディレクトリの作成
データアップロード用 Bucket に下記の通りフォルダを作成する
```
<bucket name>/
    └── exampledataset
        ├── raw/
        ├── schema/
        └── udf/
```

### 2-4. BigQuery テーブルのスキーマ定義ファイル作成
exampletable_schema.json
```
{
  "BigQuery Schema": [
    {
      "description": "ユーザーID",
      "name": "id",
      "type": "INT64"
    },
    {
      "description": "名前",
      "name": "name",
      "type": "STRING"
    },
    {
      "description": "ふりがな",
      "name": "ruby",
      "type": "STRING"
    },
    {
      "description": "メールアドレス",
      "name": "email",
      "type": "STRING"
    },
    {
      "description": "性別",
      "name": "sex",
      "type": "STRING"
    },
    {
      "description": "年齢",
      "name": "age",
      "type": "INT64"
    },
    {
      "description": "誕生日",
      "name": "birthday",
      "type": "DATE"
    },
    {
      "description": "都道府県",
      "name": "prefectures",
      "type": "STRING"
    },
    {
      "description": "電話番号",
      "name": "tel",
      "type": "STRING"
    }
  ]
}
```
### 2-5. Cloud Dataflow で使用するデータ加工用 Javascript を作成
exampletable_udf.json
```
function transformCSV(line) {
    var values = line.split(',');
    var obj = new Object();
    
    // Edit the below line
    obj.id = values[0];
    obj.name = values[1];
    obj.ruby = values[2];
    obj.email = values[3];
    obj.sex = values[4];
    obj.age = values[5];
    obj.birthday = values[6];
    obj.prefectures = values[7];
    obj.tel = values[8];
    // Edit the above line

    var jsonString = JSON.stringify(obj);
    return jsonString;
}

function transformJSON(line) {
    return line;
}
```

### 2-6. ファイルの配置
「2-3.」で作成したディレクトリに「exampletable_schema.json」と「exampletable_udf.json」を配置する。
```
<bucket name>/
    └── exampledataset
        ├── raw/
        ├── schema/
        │   └── exampletable_schema.json
        └── udf/
            └── exampletable_udf.json
```

## 3. Cloud Functions のデプロイ
### 3-1. このリポジトリをClone

### 3-2. constants.js の設定
handleRawDataFileUploaded/constants.js
```
module.exports = Object.freeze({
    PROJECT_ID: '<使用するGCPプロジェクトID>',
    BUCKET_NAME: '<データアップロード用バケット名>'
});
```

## 3-3. デプロイ
```
gcloud auth login
gcloud config set project <使用するGCPプロジェクトID>
cd handleRawDataFileUploaded
gcloud functions deploy handleRawDataFileUploaded --region asia-northeast1 --runtime nodejs8 --trigger-resource <データアップロード用バケット名> --trigger-event google.storage.object.finalize
```

## 4. 動作確認
### 4-1. raw/ ディレクトリにサンプルデータをアップロードして BigQuery にデータ連携されている事を確認する
