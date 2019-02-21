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