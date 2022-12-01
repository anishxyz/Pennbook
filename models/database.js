var AWS = require('aws-sdk');
const { check_login } = require('../routes/routes');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();
var SHA256 = require("crypto-js/sha256");
const { get } = require('http');
const { uuidv4  } = require('uuid');

// Helper function that checks if username is in use or not
// Error 1 means invalid username
var user_exists = function(username, callback) {
  var params = {
    KeyConditions: {
      username: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [ { S: username } ]
      }
    },
    TableName: "users"
  };

  db.query(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      callback(null, data.Items.length != 0);
    }
  });
}

// Error 1 means some database error
// Error 2 means username already in use
// Returns username as data
var create_user = function(username, email, firstName, lastName, password, affiliation, birthday, callback) {
  // Log info
  console.log("Registering user with following attributes:");
  console.log("Username: " + username);
  console.log("Email: " + email);
  console.log("First name: " + firstName);
  console.log("Last name: " + lastName);
  console.log("Password: " + password.charAt(0) + "*".repeat(password.length - 1));
  console.log("Affiliation: " + affiliation);
  console.log("Birthday: " + birthday);

  // Hash password
  password = SHA256(password);

  user_exists(username, function(err, data) {
    if (err) {
      callback("1", null);
    } else if (data) {
      callback("2", null);
    } else {
        // If username not in use, make new user
        var params = {
          Item: {
            username: {
              S: username
            },
            email: { 
              S: email
            },
            firstName: { 
              S: firstName
            },
            lastName: {
              S: lastName
            },
            password: { 
              S: password
            },
            affiliation: { 
              S: affiliation
            },
            birthday: { 
              S: birthday
            }
          },
          TableName: "users"
      };

      db.putItem(params, function(err, data){
          if (err)
            callback("1", null);
          else
            callback(null, username);
      });
    }
  });
}

// Error 1 means user does not exist
var get_user_info = function(username, callback) {
  var params = {
    KeyConditions: {
      username: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [ { S: username } ]
      }
    },
    TableName: "users"
  };

  db.query(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      callback(null, data.Items[0]);
    }
  });
}

// Updates provided attribute of user
// Error 1 means issue while querying table
var update_user_info = function(username, attribute, value, callback) {
  update_expression = "SET " + attribute + " = :value";

  var params = {
    TableName: "users",
    Key: {
      username: username
    },
    UpdateExpression: update_expression,
    ExpressionAttributeValues: {
      ":label": value
    }
  };

  db.updateItem(params, function(err, data) {
    if (err) {
      callback("1", null);
    } else {
      callback(null, value);
    }
  });
}

// Bidirectional
// Error 1 means issue while adding to database
var add_friendship = function(friend1, friend2, callback) {
  console.log("Creating friendship");
  console.log("Friend 1: " + friend1);
  console.log("Friend 2: " + friend2);

  var params = {
    Item: {
      friend1: {
        S: friend1
      },
      friend2: {
        S: friend2
      },
    },
    TableName: "friendships"
  };

  db.putItem(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      params = {
        Item: {
          friend1: {
            S: friend2
          },
          friend2: {
            S: friend1
          },
        },
        TableName: "friendships"
      };
      db.putItem(params, function(err, data) {
        if (err) {
          console.log(err);
          callback("1", null);
        } else {
          callback(null, "Success");
        }
      });
    }
  })
}

// Get friends of user
// Error 1 means issue while querying
var get_friends = function(username, callback) {
  var params = {
    KeyConditions: {
      friend1: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [ { S: username } ]
      }
    },
    AttributesToGet: ["friend2"],
    TableName: "friendships"
  };

  db.query(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      if (data == null) {
        callback(null, []);
      } else {
        friends = [];
        for (friend of data.Items) {
          friends.push(friend.S);
        }
        callback(null, friends);
      }
    }
  })
}

// Gets posts
// Error 1 means issue while querying for friends
// Error 2 means issue while querying for posts
var get_posts_for_user = function(username, callback) {
  get_friends(username, function(err, data) {
    if (err) {
      callback("1", null);
    } else {
      queries = [];
      for (friend of data) {
        queries.push({
          username: {
            S: friend
          }
        });
      }
      params = {
        RequestItems: {
          users_to_posts: {
            Keys: queries,
            ProjectionExpression: "post_id"
          }
        }
      };
      db.batchGetItem(params, function(err, data) {
        if (err) {
          callback("2", null);
        } else {
          callback(null, data.Items);
        }
      });
    }
  });
}

// Gets information for one post_id
// Error 1 means issue while querying database
// Error 2 means post_id not found
var get_post = function(post_id, callback) {
  var params = {
    KeyConditions: {
      post_id: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [ { S: post_id } ]
      }
    },
    TableName: "posts"
  };
  db.query(params, function(err, data) {
    if (err) {
      callback("1", null);
    } else {
      if (data.Items.length == 0) {
        callback("2", null);
      } else {
        callback(null, data.Items[0]);
      }
    }
  })
}

// Gets information for multiple post_ids
// Error 1 means issue while querying database
var get_posts = function(post_id_list, callback) {
  queries = [];
  for (post_id of post_id_list) {
    queries.push({
      post_id: {
        S: post_id
      }
    });
  }
  params = {
    RequestItems: {
      posts: {
        Keys: queries
      }
    }
  };
  db.batchGetItem(params, function(err, data) {
    if (err) {
      callback("1", null);
    } else {
      callback(null, data.Items);
    }
  });
}

// Error 1 means username not found
// Error 2 means password incorrect
// Returns username as data
var login_check = function(username, password, callback) {
    console.log("Checking if login is valid for following parameters:");
    console.log("Username: " + username);
    console.log("Password: " + password.charAt(0) + "*".repeat(password.length - 1));

    // Hash password provided
    password = SHA256(password);

    var params = {
        KeyConditions: {
          username: {
            ComparisonOperator: 'EQ',
            AttributeValueList: [ { S: username } ]
          }
        },
        TableName: "users"
    };

    db.query(params, function(err, data) {
        if (err || data.Items.length == 0) {
            callback("1", null);
        } else {
            if (data.Items[0].password.S != password) {
                callback("2", null);
            } else {
                callback(null, data.Items[0].username.S);
            }
        }
    });
}

// Error 1 means issue while adding to database
// Returns post_id as data
var add_post = function(creator, type, content, timestamp, callback) {
  console.log("Creating new post with content:");
  console.log("Creator: " + creator);
  console.log("Type: " + type);
  console.log("Content: " + content);

  id = uuidv4();

  var params = {
    Item: {
      post_id: {
        S: id
      },
      creator: {
        S: creator
      },
      type: { 
        S: type
      },
      content: { 
        S: content
      },
      timestamp: {
        N: timestamp
      },
    },
    TableName: "posts"
  };

  // Write to posts table
  db.putItem(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      params = {
        Item: {
          username: {
            S: creator
          },
          post_id: {
            S: id
          }
        },
        TableName: "users_to_posts"
      }
      // Write to users_to_posts table
      db.putItem(params, function(err, data) {
        if (err) {
          console.log(err);
          callback("1", null);
        } else {
          callback(null, id);
        }
      });
    }
  });
}

// Error 1 means issue while writing to database
// Returns comment_id as data
var add_comment = function(creator, post_id, timestamp, content, callback) {
  console.log("Creating new comment with content:");
  console.log("Creator: " + creator);
  console.log("Post: " + post_id);
  console.log("Content: " + content);

  id = uuidv4();

  // First write to comments
  var params = {
    Item: {
      comment_id: {
        S: id
      },
      creator: {
        S: creator
      },
      content: { 
        S: content
      },
      timestamp: {
        N: timestamp
      },
      post_id: {
        S: post_id
      }
    },
    TableName: "comments"
  };

  db.putItem(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      // Next write to posts_to_comments
      params = {
        Item: {
          post_id: {
            S: post_id
          },
          comment_id: {
            S: id
          }
        },
        TableName: "posts_to_comments"
      };
      db.putItem(params, function(err, data) {
        if (err) {
          console.log(err);
          callback("1", null);
        } else {
          callback(null, id);
        }
      });
    }
  });
}

var database = { 
  createUser: create_user,
  loginCheck: login_check,
  addPost: add_post,
  addComment: add_comment,
  addFriendship: add_friendship,
  getFriends: get_friends,
  getPostsForUser: get_posts_for_user,
  getPost: get_post,
  getPosts: get_posts,
  getUserInfo: get_user_info,
  updateUserInfo: update_user_info
};
  
module.exports = database;