/* This code loads some test data into a DynamoDB table. You _could_ modify this
   to upload test data for HW4 (which has different tables and different data),
   but you don't have to; we won't be grading this part. If you prefer, you can
   just stick your data into DynamoDB tables manually, using the AWS web console. */

var AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();
var async = require('async');
const session = require("express-session");


/* We begin by defining the name of the table and the data we want to upload */

var userDB = "users";
//[uname, email, fname, lname, pass, affil, bday, inter]
var usersInit =
    [
        ["Mickey", "@g", "Mickey", "Mouse", "Disney", "Char", "1", "10"],
        ["Anish", "@a", "Anish", "Agrawal", "UPenn", "Stu", "2", "20"],
        ["John", "@j", "John", "Doe", "Slack", "User", "3", "30"]
    ]
var postDB = "posts";
// [id, cre, type, content, time]
var postInit = [["Cane", "Night", "150", "-34", "Mickey"],["El Taco", "Morn", "150.5", "-34.5", "Anish"]];


/* This function puts an item into the table. Notice that the column is a parameter;
   hence the unusual [column] syntax. This function might be a good template for other
   API calls, if you need them during the project. */

var putUserIntoTable = function(tableName, name, e, f, l, p, a, b, inter, callback) {
    var params =  {
        Item: {
            username: {
                S: name
            },
            email: {
                S: e
            },
            firstName: {
                S: f
            },
            lastName: {
                S: l
            },
            password: {
                S: p
            },
            affiliation: {
                S: a
            },
            birthday: {
                S: b
            },
            interests: {
                SS: inter
            }
        },
        TableName: tableName
    };

    db.putItem(params, function(err, data){
        if (err)
            callback(err)
        else
            callback(null, 'Success')
    });
}

var putRestsIntoTable = function(tableName, id, c, t, cont, time, callback) {
    var params ={
        Item: {
            post_id: {
                S: id
            },
            creator: {
                S: c
            },
            type: {
                S: t
            },
            content: {
                S: cont
            },
            timestamp: {
                N: time
            },
        },
        TableName: tableName
    };

    db.putItem(params, function(err, data){
        if (err)
            callback(err)
        else
            callback(null, 'Success')
    });
}


/*
Initializes users database and adds users from array
 */
/*
initUserTable(userDB, function(err, data) {
  if (err)
    console.log("Error while initializing table: "+err);
  else {
    async.forEach(usersInit, function (u, callback) {
      console.log("Uploading user: " + u[0]);
      putUserIntoTable(userDB, u[0], u[1], u[2], function(err, data) {
        if (err)
          console.log("Oops, error when adding "+u[0]+": " + err);
      });
    }, function() { console.log("Upload complete")});
  }
});
 */

/*
Initializes restaurant database and adds restaurants from array
 */
/*
initRestTable(restDB, function(err, data) {
  if (err)
    console.log("Error while initializing table: "+err);
  else {
    async.forEach(restInit, function (r, callback) {
      console.log("Uploading user: " + r[0]);
      putRestsIntoTable(restDB, r[0], r[1], r[2], r[3], r[4], function(err, data) {
        if (err)
          console.log("Oops, error when adding "+r[0]+": " + err);
      });
    }, function() { console.log("Upload complete")});
  }
});
 */

async.forEach(usersInit, function (u, callback) {
    console.log("Uploading user: " + u[0]);
    putUsersIntoTable(userDB, u[0], u[1], u[2], u[3], u[4], u[5], u[6], u[7], function(err, data) {
        if (err)
            console.log("Oops, error when adding "+r[0]+": " + err);
    });
}, function() { console.log("Upload complete")});
