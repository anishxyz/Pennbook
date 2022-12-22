var AWS = require('aws-sdk');
const { check_login } = require('../routes/routes');
AWS.config.update({region:'us-east-1'});
var db = new AWS.DynamoDB();
var SHA256 = require("crypto-js/sha256");
const { get } = require('http');
const { v4: uuidv4  } = require('uuid');

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
var create_user = function(username, email, firstName, lastName, password, affiliation, birthday, interests, callback) {
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

  password = JSON.stringify(SHA256(password).words);

  user_exists(username, function(err, data) {
    if (err) {
      callback(err, null);
    } else if (data) {
      callback(err, null);
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
            },
            interests: {
              SS: interests
            },
            online: {
              S: "yes"
            }
          },
          TableName: "users"
      };

      db.putItem(params, function(err, data){
          if (err) {
            console.log(err);
            callback(err, null);
          } else {
            callback(null, username);
          }
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
  if (attribute == "password") {
    value = JSON.stringify(SHA256(value).words);
  }
  
  update_expression = "SET " + attribute + " = :value";

  if (attribute == "interests") {
    var params = {
      TableName: "users",
      Key: {
        username: {S: username}
      },
      UpdateExpression: update_expression,
      ExpressionAttributeValues: {
        ":value": {SS: value}
      }
    };
  } else if (attribute == "online") {
    update_expression = "SET #o = :value";
    var params = {
      TableName: "users",
      Key: {
        username: {S: username}
      },
      UpdateExpression: update_expression,
      ExpressionAttributeValues: {
        ":value": {S: value}
      },
      ExpressionAttributeNames: {
        "#o": "online"
      }
    };
  } else {
    var params = {
      TableName: "users",
      Key: {
        username: {S: username}
      },
      UpdateExpression: update_expression,
      ExpressionAttributeValues: {
        ":value": {S: value}
      }
    };
  }

  db.updateItem(params, function(err, data) {
    if (err) {
      callback(err, null);
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
          friends.push(friend.friend2.S);
        }
        callback(null, friends);
      }
    }
  });
}

// Gets posts for all friends of provided user
// Error 1 means issue while querying for friends
// Error 2 means issue while querying for posts
var get_posts_for_user_friends = function(username, callback) {
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
      queries.push({
        username: {
          S: username
        }
      });
      params = {
        RequestItems: {
          users_to_posts: {
            Keys: queries,
            ProjectionExpression: "posts"
          }
        }
      };
      db.batchGetItem(params, function(err, data) {
        if (err) {
          console.log(err);
          callback("2", null);
        } else {
          posts = [];
          postsSet = new Set();
          for (user_posts of data.Responses.users_to_posts) {
            for (post_id of user_posts.posts.SS) {
              if (postsSet.has(post_id)) {
                continue;
              }
              postsSet.add(post_id);
              posts.push(post_id);
            }
          }
          callback(null, posts);
        }
      });
    }
  });
}

// Gets login status for multiple users
var get_users_status = function(users, callback) {
  if (users == null || users.length == 0) {
    callback(null, []);
    return;
  }
  queries = [];
  for (username of users) {
    queries.push({
      username: {
        S: username
      }
    });
  }
    console.log(queries);
    var params = {
      RequestItems: {
        users: {
          Keys: queries,
          ExpressionAttributeNames: {
            "#u": "username",
            "#o": "online"
          },
          ProjectionExpression: "#u, #o"
        }
      }
    };
    db.batchGetItem(params, function(err, data) {
      if (err) {
        console.log(err);
        callback("1", null);
      } else {
        arr = data.Responses.users;
        arr.sort(function(a, b) {
          if (a.online.S == "yes" && b.online.S == "no") {
            return -1;
          } else if (a.online.S == "no" && b.online.S == "yes") {
            return 1;
          } else {
            if (a.username.S > b.username.S) {
              return 1;
            } else {
              return -1;
            }
          }
        })
        callback(null, arr);
      }
    });
}

// Gets affiliations for a list of users
var get_users_affiliation = function(users, callback) {
  if (users == null || users.length == 0) {
    callback(null, []);
    return;
  }
  queries = [];
  for (username of users) {
    queries.push({
      username: {
        S: username
      }
    });
  }
    console.log(queries);
    var params = {
      RequestItems: {
        users: {
          Keys: queries,
          ExpressionAttributeNames: {
            "#u": "username",
            "#a": "affiliation"
          },
          ProjectionExpression: "#u, #a"
        }
      }
    };
    db.batchGetItem(params, function(err, data) {
      if (err) {
        console.log(err);
        callback("1", null);
      } else {
        callback(null, data.Responses.users);
      }
    });
}

// Gets post_id's for a given user
// Error 1 means issue while querying
var get_posts_for_user = function(username, callback) {
  var params = {
    KeyConditions: {
      username: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [ { S: username } ]
      }
    },
    AttributesToGet: ["posts"],
    TableName: "users_to_posts"
  };

  db.query(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      console.log(data.Items);
      if (data == null) {
        callback(null, []);
      } else {
        posts = [];
        postsSet = new Set();
        if (!data.Items || data.Items.length == 0) {
          callback(null, []);
          return;
        }
        for (post_id of data.Items[0].posts.SS) {
          if (postsSet.has(post_id)) {
            continue;
          }
          postsSet.add(post_id);
          posts.push(post_id);
        }
        console.log(posts);
        callback(null, posts);
      }
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
  if (post_id_list == null || post_id_list.length == 0) {
    callback(null, []);
    return;
  }
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
      console.log(err);
      callback("1", null);
    } else {
      res = data.Responses.posts;
      res.sort(function(a, b) {
        if (a.timestamp.N > b.timestamp.N) {
          return -1;
        } else {
          return 1;
        }
      });
      
      for (item of res) {
        if (item.content.S.includes("posted on") && item.content.S.includes("'s wall.")) {
          item.creator.S = item.content.S.split(" ")[0];
        }
      }

      callback(null, res);
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
    password = JSON.stringify(SHA256(password).words);

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

// Adds a post_id under a user
var add_post_to_user = function(username, post_id, callback) {
  // First get original posts set
  params = {
    KeyConditions: {
      username: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [ { S: username } ]
      }
    },
    TableName: "users_to_posts",
    AttributesToGet: ["posts"]
  };
  db.query(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      if (data.Items.length == 0) {
        newPosts = [];
      } else {
        newPosts = data.Items[0].posts.SS;
      }
      newPosts.push(post_id);

      // Update posts table
      params = {
        Item: {
          username: {
            S: username
          },
          posts: {
            SS: newPosts
          }
        },
        TableName: "users_to_posts"
      }
      db.putItem(params, function(err, data) {
        if (err) {
          console.log(err);
          callback("1", null);
        } else {
          callback(null, id);
        }
      })
    }
  });
}

// Error 1 means issue while adding to database
// Returns post_id as data
// types: post, status_update, friend_update
var add_post = function(creator, type, content, timestamp, callback) {
  console.log("Creating new post with content:");
  console.log("Creator: " + creator);
  console.log("Type: " + type);
  console.log("Content: " + content);
  console.log("Timestamp: " + timestamp);

  // Convert timestamp to a string
  timestamp = timestamp.toString();

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
      // First get original posts set
      params = {
        KeyConditions: {
          username: {
            ComparisonOperator: 'EQ',
            AttributeValueList: [ { S: creator } ]
          }
        },
        TableName: "users_to_posts",
        AttributesToGet: ["posts"]
      };
      db.query(params, function(err, data) {
        if (err) {
          console.log(err);
          callback("1", null);
        } else {
          if (data.Items.length == 0) {
            newPosts = [];
          } else {
            newPosts = data.Items[0].posts.SS;
          }
          newPosts.push(id);

          // Update posts table
          params = {
            Item: {
              username: {
                S: creator
              },
              posts: {
                SS: newPosts
              }
            },
            TableName: "users_to_posts"
          }
          db.putItem(params, function(err, data) {
            if (err) {
              console.log(err);
              callback("1", null);
            } else {
              callback(null, id);
            }
          })
        }
      });
    }
  });
}

// Adds multiple posts for one creator
// Error 1 means issue while posting to database
var add_posts = function(posts, creator, callback) {
  if (posts == null || posts.length == 0) {
    callback(null, null);
    return;
  }
  ids = [];
  requests = [];
  for (post of posts) {
    id = uuidv4();
    ids.push(id);
    timestamp = post.timestamp.toString();
    requests.push({
      PutRequest: {
        Item: {
          post_id: {
            S: id
          },
          content: {
            S: post.content
          },
          creator: {
            S: creator
          },
          timestamp: {
            N: timestamp
          },
          type: {
            S: post.type
          }
        }
      }
    });
  }

  var params = {
    RequestItems: {
      posts: requests
    }
  };

  console.log(requests);
  db.batchWriteItem(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      // First get original posts set
      params = {
        KeyConditions: {
          username: {
            ComparisonOperator: 'EQ',
            AttributeValueList: [ { S: creator } ]
          }
        },
        TableName: "users_to_posts",
        AttributesToGet: ["posts"]
      };
      db.query(params, function(err, data) {
        if (err) {
          console.log(err);
          callback("1", null);
        } else {
          if (data.Items.length == 0) {
            newPosts = [];
          } else {
            newPosts = data.Items[0].posts.SS;
          }
          newPosts = newPosts.concat(ids);

          console.log(newPosts);
          // Update user_to_posts table
          params = {
            Item: {
              username: {
                S: creator
              },
              posts: {
                SS: newPosts
              }
            },
            TableName: "users_to_posts"
          }
          db.putItem(params, function(err, data) {
            if (err) {
              console.log(err);
              callback("1", null);
            } else {
              callback(null, ids);
            }
          })
        }
      });
    }
  });
}

// Adds a comment
// Error 1 means issue while writing to database
var add_comment = function(creator, post_id, timestamp, content, callback) {
  timestamp = timestamp.toString();

  var params = {
    Item: {
      post_id: {
        S: post_id
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
    },
    TableName: "posts_to_comments"
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

// Gets comments for a specific post_id
// Error 1 means issue while querying database
var get_comments_for_post = function(post_id, callback) {
  var params = {
    KeyConditions: {
      post_id: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [ { S: post_id } ]
      }
    },
    TableName: "posts_to_comments"
  };

  db.query(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      comments = data.Items;
      comments.sort(function(a, b) {
        if (a.timestamp.N > b.timestamp.N) {
          return 1;
        } else {
          return -1;
        }
      });
      callback(null, comments);
    }
  })
}

// Creates a new chat
var create_chat = function(users, callback) {
  users.sort();
  usersString = users.join(",");
  id = uuidv4();
  requests = [];
  for (user of users) {
    requests.push({
      PutRequest: {
        Item: {
          username: {
            S: user
          },
          chat_id: {
            S: id
          }
        }
      }
    });
  }

  // First write to users_to_chats
  var params = {
    RequestItems: {
      users_to_chats: requests
    }
  };
  console.log("GOT TO HERE 1")
  db.batchWriteItem(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      console.log("GOT TO HERE 2")
      // Next write to userlists_to_chats
      params = {
        Item: {
          userlist: {
            S: usersString
          },
          chat_id: {
            S: id
          }
        },
        TableName: "userlists_to_chats"
      }
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


// Gets chat_id for specified list of users
var get_chat_for_users = function(users, callback) {
  users.sort();
  usersString = users.join(",");
  console.log("USERSTRING HERE ", usersString)
  var params = {
    KeyConditions: {
      userlist: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [ { S: usersString } ]
      }
    },
    TableName: "userlists_to_chats"
  };

  db.query(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      if (data.Items[0] == null) {
        callback(null, null);
      } else {
        callback(null, data.Items[0].chat_id.S);
      }
    }
  })
}

// Gets all chat_ids for a user
var get_chats_for_user = function(username, callback) {
  var params = {
    KeyConditions: {
      username: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [ { S: username } ]
      }
    },
    AttributesToGet: ["chat_id"],
    TableName: "users_to_chats"
  };

  db.query(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      chat_ids = [];
      for (item of data.Items) {
        chat_ids.push(item.chat_id.S);
      }
      callback(null, chat_ids);
    }
  });
}

// Adds a message to a chat
var add_message_to_chat = function(message, creator, chat_id, timestamp, callback) {
  var params = {
    Item: {
      chat_id: {
        S: chat_id
      },
      creator: {
        S: creator
      },
      message: {
        S: message
      },
      timestamp: {
        N: timestamp.toString()
      }
    },
    TableName: "chats"
  };

  db.putItem(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      callback(null, 'Success');
    }
  });
}

// Gets all messages in a chat
var get_chat_messages = function(chat_id, callback) {
  var params = {
    KeyConditions: {
      chat_id: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [ { S: chat_id } ]
      }
    },
    TableName: "chats"
  };

  db.query(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {
      callback(null, data.Items);
    }
  });
}

// Provides search results for a substring
var search_for_user = function(sub, callback) {
  console.log("Here 1");
  var params = {
    TableName: "users",
    FilterExpression: "contains(username, :sub)",
    ExpressionAttributeValues: {
      ":sub": {
        S: sub
      }
    }
  };

  // Use the DynamoDB DocumentClient to query the users table and
  // return the matching username keys
  db.scan(params, function(err, data) {
    console.log("Here 2");
    if (err) {
      console.error("Error querying users table:", JSON.stringify(err, null, 2));
      callback(err);
    } else {
      var usernameKeys = data.Items.map(function(item) {
        return item.username.S;
      });

      console.log(usernameKeys);

      // Sort the username keys by the index of the first occurrence
      // of the substring, from smallest to largest
      usernameKeys.sort(function(a, b) {
        var subIndexA = a.indexOf(sub);
        var subIndexB = b.indexOf(sub);

        // If the substring occurs at the same index in both
        // usernames, sort by length instead
        if (subIndexA === subIndexB) {
          return a.length - b.length;
        } else {
          return subIndexA - subIndexB;
        }
      });

      console.log(usernameKeys);

      callback(null, usernameKeys);
    }
  });
};

// Gets articles for a given user
var get_articles_for_user = function(username, callback) {

  console.log("username: " + username);
  var params = {
    KeyConditions: {
      username: {
        ComparisonOperator: 'EQ',
        AttributeValueList: [ { S: username } ]
      }
    },
    AttributesToGet: ["seen_articles"],
    TableName: "user_feed_articles"
  };
  db.query(params, function(err, data) {
    if (err) {
      console.log(err);
      callback("1", null);
    } else {

      queries = [];
      //console.log(data.Items[0].seen_articles);
      for (article of data.Items[0].seen_articles.L) {
        let now = new Date();
        let dateStr = now.getFullYear().toString() + now.getMonth().toString() + now.getDate().toString();
        
        queries.push({
            N: article.N 
        });
      }

      //console.log(queries);
      if (queries.length == 0) {
        callback(null, []);
      }
      else {
         
        var params1 = {
          KeyConditions: {
            article_id: {
              ComparisonOperator: 'EQ',
              AttributeValueList: [ queries[queries.length - 1] ]
            }
          },
          AttributesToGet: ["article_id", "date", "short_description", "authors", "category", "headline", "link"],
          TableName: "articles"
        };
        
        db.query(params1, function(err, data) {
            if(err) {
                callback(err, null);
            }
            else {
                callback(null, data.Items);
            }
        });
      }
        
    }
  });

}

// Likes an article for a user
var like_article = function(username, article_id) {
    
  console.log(username + " liked " + article_id);
  var params = {
    Item: {
      username: {
        S: username
      },
      article_id: {
        N: article_id
      },
    },
    TableName: "user_liked_articles"
  };
  db.putItem(params, function(err, data) {
    if (err) {
        console.log(err);
    }
  });

}
var search_articles = async function(kws, callback) {
    let promise_arr = kws.map(kw => {
        const params = {
            KeyConditionExpression: "keyword = :kw",
            ExpressionAttributeValues: {
                ":kw": { S: kw },
            },
            TableName: "invertedArticles",
        };
        return db.query(params).promise();
    });
    let data = await Promise.all(promise_arr);
    let flattened = data.map(x => x.Items).flat().map(obj => obj.article_id.N);
    let obj_tmp = {}
    for (key of flattened) {
        if(!(key in obj_tmp)) {
            obj_tmp[key] = 0;
        }
        obj_tmp[key]++;
    }
    let pair_arr = Object.entries(obj_tmp);
    pair_arr.sort((a, b) => (b[1]-a[1]));
    let filtered = pair_arr.map(x => x[0]);
    let promise_arr2 = filtered.map(article_id => {
        const params = {
            KeyConditionExpression: "article_id = :a_id",
            ExpressionAttributeValues: {
                ":a_id": { N: article_id },
            },
            TableName: "articles",
        };
        return db.query(params).promise();
    });
    let data2 = await Promise.all(promise_arr2);
    let flattened2 = data2.map(x => x.Items).flat().slice(0, 5);
    //console.log("printing data");
    //console.log(flattened2);
    callback(null, flattened2);

}


var database = { 
  createUser: create_user,
  loginCheck: login_check,
  addPost: add_post,
  addComment: add_comment,
  addFriendship: add_friendship,
  getFriends: get_friends,
  getPostsForUser: get_posts_for_user,
  getPostsForUserFriends: get_posts_for_user_friends,
  getPost: get_post,
  getPosts: get_posts,
  getUserInfo: get_user_info,
  updateUserInfo: update_user_info,
  addPosts: add_posts,
  getUsersStatus: get_users_status,
  createChat: create_chat,
  getChatsForUsers: get_chat_for_users,
  getChatsForUser: get_chats_for_user,
  addMessageToChat: add_message_to_chat,
  getChatMessages: get_chat_messages,
  searchUser: search_for_user,
  getUsersAffiliation: get_users_affiliation,
  getCommentsForPost: get_comments_for_post,
  addPostToUser: add_post_to_user,
  getArticlesForUser: get_articles_for_user,
  likeArticle: like_article,
  searchArticles: search_articles,
};
  
module.exports = database;
