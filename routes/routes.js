const { addPost, getUserInfo } = require('../models/database.js');
var db = require('../models/database.js');
const stemmer = require('stemmer');

// routes here
 var getMain = function(req, res) {
   if (req.session.username != null) {
    res.redirect('/home');
   } else if (req.session.loginBlank != true && req.session.loginIncorrect != true) {
       res.render('loginpage.ejs', {message: null});
  } else if (req.session.loginBlank == true) {
       req.session.loginBlank=false;
    res.render('loginpage.ejs', {message: 'Please complete all fields.'});
  } else if (req.session.loginIncorrect == true) {
    req.session.loginIncorrect=false;
    res.render('loginpage.ejs', {message: 'Username or password is incorrect.'});
  }
};


var getEnterChat = function(req, res) {
  res.render('enterchat.ejs', {message: null});
};

 var startChat = async function(req, res) {
    var validAdditons = true;

    // first get all friends to pass in
    db.getFriends(req.session.username, function(err, friendsList) {
      console.log("FRIENDS HERE", friendsList);
      var otherUsers = req.body.usernameInput + "," + req.body.newUsernameInput;
    console.log(otherUsers)
    console.log("TOTAL OTHERS ARE ", otherUsers.split(","));

    // sort list of users then stringfy that list and look in db if any existing chats with this group

    var list_of_users = otherUsers.split(",");
    list_of_users.push(req.session.username);
    list_of_users = list_of_users.filter(function(e) { return e !== 'undefined' })
    list_of_users = list_of_users.filter((element, index) => {
      return list_of_users.indexOf(element) === index;
  });


    var sorted_list_of_users = list_of_users.sort();
    var prevMessages = [];
    var chat_id = 0;

    // check if chat exists for this group of users. If so, use those messages. If not, create a new chat. 
     db.getChatsForUsers(sorted_list_of_users, function(err, data) {    
        if (data == null) {
          // create a new chat
          db.createChat(sorted_list_of_users, function(err, data) {  
            if (err) {
            } else {
              chat_id = data;
              res.render('chat.ejs', {message: null, user: req.session.username, otherUsers: sorted_list_of_users.toString(), chat_id: chat_id, prevMessages: prevMessages.toString(), friends: friendsList.toString()});
            }
          });
        } else {
          chat_id = data;
          db.getChatMessages(chat_id, function(err, data) {
            // append the name of the creator to each message, to be extracted later
            for (entry of data) {
              prevMessages.push(entry.creator.S + ": " + entry.message.S);
            }
            res.render('chat.ejs', {message: null, user: req.session.username, otherUsers: sorted_list_of_users.toString(), chat_id: chat_id, prevMessages: prevMessages.toString(), friends: friendsList.toString()});
          });
        }
    });
    })
 };

 var getCreatePost = function(req, res) {
   if (req.session.postInfoBlank == true) {
    res.render('createpost.ejs', {message: 'Please complete all fields.', currUser: req.session.username});
   } else if (req.session.postFailed == true) {
    res.render('createpost.ejs', {message: 'Post failed. Please try again.', currUser: req.session.username});
   } else if (req.session.postSucceeded == true) {
    req.session.postSucceeded = false;
    res.redirect('/');
   } else {
    res.render('createpost.ejs', {message: null, currUser: req.session.username});
   }
};

 var logincheck = function(req, res) {
   var uname = req.body.usernameInput;
   var pass= req.body.passInput;
   
   // if anything blank reload w error
   if (uname=="" || uname == null || pass=="" || pass == null) {
    req.session.loginBlank=true;
     res.redirect('/');
 } 
 else {
    // otherwise check db
     db.loginCheck(uname, pass, function(err, data) {    
 
       if (err == null) {
         req.session.username=uname;
         // Make user online
         db.updateUserInfo(uname, "online", "yes", function(err, data) {
          if (err) {
            console.log(err);
          }
          res.redirect('/home');
         });
       } else {
         req.session.loginIncorrect=true;
         res.redirect('/');
       }
     });
   }
 };


 var getsignup = function(req, res) {
   // if all good, just go to the page otherwise show approriate error
   if (req.session.lessInterests) {
    req.session.lessInterests = false;
    res.render('signup.ejs', {message: "Please enter at least two interests."});
   } else if (!req.session.unameExist && !req.session.blankSign) {
    res.render('signup.ejs', {message: null});
   } else if (req.session.unameExist) {
    req.session.unameExist=false;
     res.render('signup.ejs', {message: 'Username already exists.'});
    } else if (req.session.blankSign) {
    req.session.blankSign=false;
     res.render('signup.ejs', {message: 'Please complete all fields.'});
    }
   
 };

 var getEditAccPage = function(req, res) {

  // if they tried to enter this page directly before logging in
  if (req.session.username == null) {
    res.render('signup.ejs', {message: null});
    return;
  }

  // get the existing info and autopopulate
  db.getUserInfo(req.session.username, function(err, data) {  
   
    var message = null;
    if (req.session.blankAccField == true) {
      req.session.blankAccFalse == true
      message = "Please complete all fields."
    } else if (req.session.accChangeDidNotWork == true) {
      req.session.accChangeDidNotWork == true
      message = "Change did not work, please try again."
    } 

    console.log(data.interests);
    interests = [];
    for (interest of data.interests.SS) {
      interests.push(interest);
    }
    req.session.interests = interests;
    interests = interests.toString();

    res.render('editaccount.ejs', 
    {message: message, 
    user:req.session.username,
    firstName: data.firstName.S,
    lastName: data.lastName.S,
    email: data.email.S,
    affiliation: data.affiliation.S,
    birthday: data.birthday.S,
    interests: interests
    });

  });
};

// get inputs
var saveAccChanges= async function(req, res) {

  var prevAffiliation = "";
  
  db.getUserInfo(req.session.username, function(err, data) {  
    if (!err) {
      prevAffiliation = data.affiliation.S;
    } else {
      console.log("Could not get current affiliation.")
    }
  });


  var username = req.session.username;
  var firstName = req.body.firstNameInput;
  var lastName = req.body.lastNameInput;
  var password = req.body.passInput;
  var email = req.body.emailInput;
  var affiliation = req.body.affiliationInput;
  var birthday = req.body.birthdayInput;

  posts = [];
  // fetch new interests.
  var interests = [];
   for (const key in req.body) {
    if (key.charAt(0) == '_') {
      interests.push(key.substring(1));
    }
   }
   if (interests.length < 2) {
    res.session.accChangeDidNotWork = true;
    res.redirect('/editaccount');
    return;
   }
   for (interest of interests) {
    if (!req.session.interests.includes(interest)) {
      interestText = req.session.username + " is now interested in " + interest + ".";
      posts.push({
        content: interestText,
        type: "status_update",
        timestamp: Date.now()
      });
    }
   }
   console.log(posts);
   req.session.interests = interests;
   

  if (!(firstName=="" || lastName=="" || email==""
  || username=="" || affiliation=="" || birthday == "")) {

    

   // if all good, add each of the changes one after another
   db.updateUserInfo(username, "firstName", firstName, function(err, data) {   
      if ((err == null)) {
        db.updateUserInfo(username, "lastName", lastName, function(err, data) {   
          if ((err == null)) {
            db.updateUserInfo(username, "email", email, function(err, data) {   
              if ((err == null)) {
                db.updateUserInfo(username, "affiliation", affiliation, async function(err, data) {   
                  if ((err == null)) {

                    // create new post with affiliation update if different from before
                    if(prevAffiliation!=affiliation) {
                      const affiliationChangeText = req.session.username + " changed their affiliation to " + affiliation + ".";
                      posts.push({
                        content: affiliationChangeText,
                        type: "status_update",
                        timestamp: Date.now()
                      });
                    }

                    db.updateUserInfo(username, "birthday", birthday, function(err, data) {   
                      if ((err == null)) {
                        db.updateUserInfo(username, "interests", interests, function(err, data) {
                          if (err == null) {
                            db.addPosts(posts, username, function(err, data) {
                              if (err == null) {
                                // only update password if new one is entered
                                if (password == "") {
                                  res.redirect('/home');
                                } else {
                                  console.log("Updating password to: ", password, "with username: ", username);
                                  db.updateUserInfo(username, "password", password, function(err, data) {
                                    if (err == null) {
                                      res.redirect('/home');
                                    } else {
                                      console.log("ERROR", err);
                                      res.session.accChangeDidNotWork = true;
                                      res.redirect('/editaccount');
                                    }
                                  })
                                }
                              } else {
                                console.log("ERROR", err);
                                res.session.accChangeDidNotWork = true;
                                res.redirect('/editaccount');
                              }
                            })
                          } else {
                            console.log("ERROR", err);
                            res.session.accChangeDidNotWork = true;
                            res.redirect('/editaccount');
                          }
                        });
                      } else {
                          console.log("ERROR", err)
                          req.session.accChangeDidNotWork = true;
                          res.redirect('/editaccount');
                      }
                    });
                  } else {
                      console.log("ERROR", err)
                      req.session.accChangeDidNotWork = true;
                      res.redirect('/editaccount');
                  }
                });
              } else {
                  console.log("ERROR", err)
                  req.session.accChangeDidNotWork = true;
                  res.redirect('/editaccount');
              }
            });
          } else {
              console.log("ERROR", err)
              req.session.accChangeDidNotWork = true;
              res.redirect('/editaccount');
          }
        });
      } else {
          console.log("ERROR", err)
          req.session.accChangeDidNotWork = true;
          res.redirect('/editaccount');
      }
    });
  } else {
   // things are empty, show appropriate error
    req.session.blankAccField=true;
    res.redirect('/editaccount');
  }
  }

    var getUserPage = function(req, res) {
        if(req.session.username == null) {
            res.redirect('signup.ejs');
            return;
        }

        var u = req.session.username;

        if (req.query.friend) {
            u = req.query.friend;
        }

        db.getPostsForUser(u, function(err, data) {
            if (err) {
                res.redirect('home.ejs');
            } else {
                db.getPosts(data, function(err, data) {
                    if (err) {
                        console.log(err);
                        res.redirect('home.ejs');
                    } else {
                        db.getFriends(u, function(err, dataf) {
                          if (err) {
                            console.log(err);
                            res.redirect('home.ejs');
                          } else {
                            db.getUserInfo(u, function(err, dataUser) {
                              if (err) {
                                console.log(err);
                                res.redirect('home.ejs');
                              } else {
                                for (post of data) {
                                  post.time_ago = time_ago(parseInt(post.timestamp.N));
                                }
                                console.log(data);
                                res.render('user.ejs', {myposts: data, friends: dataf, u:u, currUser: req.session.username, currUserInfo: dataUser});
                              }
                            });
                          }
                        });
                    }
                });
            }
        });
    }

var getHome = function(req, res) {
     if(req.session.username == null) {
        res.redirect('signup.ejs');
         return;
     }
     db.getPostsForUserFriends(req.session.username, function(err, data) {
         if (err) {
          res.redirect('signup.ejs');
         } else {
          db.getPosts(data, function(err, data) {
            if (err) {
              console.log(err);
              res.redirect('signup.ejs');
            } else {
                db.getFriends(req.session.username, function(err, dataf) {
                    if (err) {
                        console.log(err);
                        res.redirect('signup.ejs');
                    } else {
                      db.getUsersStatus(dataf, function(err, dataf2) {
                        if (err) {
                          console.log(err);
                          res.redirect('signup.ejs');
                        } else {
                          for (post of data) {
                            post.time_ago = time_ago(parseInt(post.timestamp.N));
                          }
                         
                        db.getArticlesForUser(req.session.username, function(errA, dataA) {
                            if (errA) {
                                res.render('home.ejs', {posts: data, friends: dataf2, currUser: req.session.username});
                            }
                            else {

                                //console.log(dataA);
                                dataA[0]["type"] = {"S": "article"}
                                dataA[0]["creator"] = {"S": "N/A"}
                                dataA[0]["content"] = {"S": "N/A"}
                                dataA[0]["post_id"] = {"S": "N/A"}
                                res.render('home.ejs', {posts: dataA.concat(data), friends: dataf2, currUser: req.session.username});
                            }
                        });
                        }
                      });
                    }
                });
            }
          });
         }
     });
};

// get inputs
var addPostAction= function(req, res) {
  var text = req.body.textInput;
  
  if (text == "") {
     req.session.postInfoBlank=true;
     res.redirect('/createpostpage');
  } else {
    //add the post
    db.addPost(req.session.username, "post", text, Date.now(), function(err, data) {   
      if ((err != null)) {
      console.log("HAS AN ERROR");
      console.log(err);
      req.session.postFailed=true;
        res.redirect('/createpostpage');
      } else {
        req.session.postSucceeded=true;
        res.redirect('/createpostpage');
      }
    });
  }

}


 // get inputs
var createAcc= function(req, res) {
   var firstName = req.body.firstNameInput;
   var lastName = req.body.lastNameInput;
   var email = req.body.emailInput;
   var uname = req.body.usernameInput;
   var pass = req.body.passInput;
   var affiliation = req.body.affiliationInput;
   var birthday = req.body.birthdayInput;
   
   var interests = []
   for (const key in req.body) {
    if (key.charAt(0) == '_') {
      interests.push(key.substring(1));
    }
   }
   if (interests.length < 2) {
    req.session.lessInterests = true;
    res.redirect('/signup');
    return;
   }

   if (!(firstName=="" || lastName=="" || email==""
   || uname=="" || pass=="" || affiliation=="" || birthday == "")) {
    // if all good, add 
    db.createUser(uname, email, firstName, lastName, pass, affiliation, birthday, interests, function(err, data) {   
       if ((err != null)) {
       console.log("HAS AN ERROR");
       console.log(err);
       // name alr exists
       req.session.unameExist=true;
         res.redirect('/signup');
       } else {
       //record sesh uname
         req.session.username=uname;
         res.redirect('/home');
       }
     });
   } else {
    // things are empty, show appropriate error
     req.session.blankSign=true;
     res.redirect('/signup');
   }
  }

var logout = function(req, res) {
  db.updateUserInfo(req.session.username, "online", "no", function(err, data) {
    if (err) {
      console.log(err);
    }
    req.session.destroy();
    res.redirect('/');
  });
}

// AJAX server side code to fetch posts
var updatePosts = function(req, res) {
  db.getPostsForUserFriends(req.session.username, function(err, data) {
    if (err) {
      console.log(err);
      res.send(JSON.stringify([]));
    } else {
      db.getPosts(data, function(err, data) {
        if (err) {
          console.log(err);
          res.send(JSON.stringify([]));
        } else {
          for (post of data) {
            post.time_ago = time_ago(parseInt(post.timestamp.N));
          }
          db.getArticlesForUser(req.session.username, function(err2, data2) {
            if (err2) {
                console.log(err2);
                res.send(JSON.stringify(data));
            }
            else {
                //console.log(data);
                data2[0]["type"] = {"S": "post"}
                //console.log(JSON.stringify(data2.concat(data)));
                res.send(JSON.stringify(data2.concat(data)));
            }
          })
        }
      });
    }
  });
}

// Route to write on someone else's wall
var writeOnWall = function(req, res) {
  writer = req.session.username;
  other = req.query.username;
  if (writer != other) {
    text = writer + " posted on " + other + "\'s wall: " + req.body.text;
    db.addPost(writer, "post", text, Date.now(), function(err, data) {
      if (err) {
        console.log(err);
        res.redirect('/user?friend=' + other);
      } else {
        db.addPostToUser(other, data, function(err, data2) {
          if (err) {
            console.log(err);
            res.redirect('/user?friend=' + other);
          } else {
            res.redirect('/user?friend=' + other);
          }
        })
      }
    });
  } else {
    db.addPost(writer, "status_update", req.body.text, Date.now(), function(err, data) {
      if (err) {
        console.log(err);
        res.redirect('/user?friend=' + other);
      } else {
        db.addPostToUser(other, data, function(err, data2) {
          if (err) {
            console.log(err);
            res.redirect('/user?friend=' + other);
          } else {
            res.redirect('/user?friend=' + other);
          }
        })
      }
    });
  }
}

// AJAX server side code to get online statuses for users
var updateFriends = function(req, res) {
  db.getFriends(req.session.username, function(err, data) {
    if (err) {
      console.log(err);
      res.send(JSON.stringify([]));
    } else {
      db.getUsersStatus(data, function(err, dataf) {
        if (err) {
          console.log(err);
          res.send(JSON.stringify([]));
        } else {
          res.send(JSON.stringify(dataf));
        }
      });
    }
  });
}

// Helper function to get relative time
function time_ago(time) {

  switch (typeof time) {
    case 'number':
      break;
    case 'string':
      time = +new Date(time);
      break;
    case 'object':
      if (time.constructor === Date) time = time.getTime();
      break;
    default:
      time = +new Date();
  }
  // For conversion
  var time_formats = [
    [60, 'seconds', 1], // 60
    [120, '1 minute ago', '1 minute from now'], // 60*2
    [3600, 'minutes', 60], // 60*60, 60
    [7200, '1 hour ago', '1 hour from now'], // 60*60*2
    [86400, 'hours', 3600], // 60*60*24, 60*60
    [172800, 'Yesterday', 'Tomorrow'], // 60*60*24*2
    [604800, 'days', 86400], // 60*60*24*7, 60*60*24
    [1209600, 'Last week', 'Next week'], // 60*60*24*7*4*2
    [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
    [4838400, 'Last month', 'Next month'], // 60*60*24*7*4*2
    [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
    [58060800, 'Last year', 'Next year'], // 60*60*24*7*4*12*2
    [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
    [5806080000, 'Last century', 'Next century'], // 60*60*24*7*4*12*100*2
    [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
  ];
  var seconds = (+new Date() - time) / 1000,
    token = 'ago',
    list_choice = 1;

    if (seconds <= 2) {
      return "Just now";
    }

  if (seconds < 0) {
    seconds = Math.abs(seconds);
    token = 'from now';
    list_choice = 2;
  }

  // Format by dividing by highest available
  var i = 0,
    format;
  while (format = time_formats[i++])
    if (seconds < format[0]) {
      if (typeof format[2] == 'string')
        return format[list_choice];
      else
        return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
    }
  return time;
}

var addChatMessage = function(req, res) {
	// get the info from the form
  var message = req.body.message;
  var creator = req.body.creator;
  var chat_id = req.body.chat_id;
  console.log("HERE IS THE CHAT ID WHEN ADDED", chat_id)
  var timestamp = req.body.timestamp;

    db.addMessageToChat(message, creator, chat_id, timestamp, function(err, data) {
      if (!err) {
      } else {
        console.log("COULD NOT ADD MESSAGE")
      }
    })
};

var getSearchResults = async function(req, res) {
    var q = req.query.query;
    console.log(q);

    db.searchUser(q, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            db.getFriends(req.session.username, function(err, data2) {
              if (err) {
                console.log(err);
              } else {
                let kws = q.split(" ").map(x => stemmer(x.toLowerCase()));
                db.searchArticles(kws, function(err, dataArticles) {
                    if (err) {
                        console.log(err);
                        res.render('search.ejs', {friends: data, currFriends: data2, currUser: req.session.username});
                    }
                    else {

                        res.render('search.ejs', {friends: data, currFriends: data2, currUser: req.session.username, articles: dataArticles});
                    }

                });
              }
            })
        }
    });
}

var updateSearchResults = function(req, res) {
    var q = req.query.query;
    console.log(q);

    db.searchUser(q, function(err, data) {
        if (err) {
            console.log(err);
            res.send(JSON.stringify([]));
        } else {
            res.send(JSON.stringify(data));
        }
    });
}

var getVisualizer = function(req, res) {
  db.getFriends(req.session.username, function(err, data) {
    if (err) {
      console.log(err);
      res.redirect('/home');
    } else {
      db.getUserInfo(req.session.username, function(err, data2) {
        if (err) {
          console.log(err);
          res.redirect('/home');
        } else {
          res.render('visualizer.ejs', {currUser: req.session.username, friends: data, affiliation: data2.affiliation.S});
        }
      });
    }
  });
}

var updateVisualizer = function(req, res) {
  affiliation = req.query.affiliation;
  user = req.query.username;
  console.log(affiliation);
  console.log(user);
  db.getUserInfo(user, function(err, data) {
    if (err) {
      console.log(err);
      res.send(JSON.stringify([]));
    } else {
      if (data.affiliation.S != affiliation) {
        res.send(JSON.stringify([]));
      } else {
        db.getFriends(user, function(err, data2) {
          if (err) {
            console.log(err);
            res.send(JSON.stringify([]));
          } else {
            db.getUsersAffiliation(data2, function(err, data3) {
              if (err) {
                console.log(err);
                res.send(JSON.stringify([]));
              } else {
                friends = [];
                for (friend of data3) {
                  if (friend.affiliation.S == affiliation) {
                    friends.push(friend.username.S);
                  }
                }
                console.log(friends);
                res.send(JSON.stringify(friends));
              }
            });
          }
        })
      }
    }
  })
}

var addComment = function(req, res) {
    if (req.session.username == null) {
        console.log("here");
        res.redirect('/');
    } else {
        console.log("adding comment to db");
        console.log(req.body.cont);
        console.log(req.body.id);
        db.addComment(req.session.username, req.body.id, Date.now(), req.body.cont, function(err, data) {
            if (err) {
                console.log("here2");
                console.log(err);
                res.redirect('/');
            }
        });
    }
}

var getComments = function(req, res) {
    if (req.session.username == null) {
        console.log("here");
        res.redirect('/');
    } else {
        console.log("post id: " + req.query.id);
        db.getCommentsForPost(req.query.id, function(err, data) {
            if (err) {
                console.log("here2");
                console.log(err);
                res.redirect('/home');
            } else {
              for (post of data) {
                post.time_ago = time_ago(parseInt(post.timestamp.N));
              }
                res.send(JSON.stringify(data));
            }
        });
    }
}

var addFriend = function(req, res) {
  if (req.session.username == null) {
    res.redirect('/');
  } else {
    db.addFriendship(req.session.username, req.body.friend, function(err, data) {
      if (err) {
        console.log(err);
      } else {
        text = req.session.username + " is now friends with " + req.body.friend + "."
        db.addPost(req.session.username, "friend_update", text, Date.now(), function(err, id) {
          if (err) {
            console.log(err);
          } else {
            res.redirect('/');
          }
        });
      }
    });
  }
}

var likeArticle = function(req, res) {

  if (req.session.username == null) {
    res.send(JSON.stringify([]));
  }
  else {
    db.likeArticle(req.session.username, req.query.id); 
  }

}

var routes = {
    get_main: getMain,
    post_start_chat: startChat,
    get_enter_chat: getEnterChat,
    add_chat_message: addChatMessage,
    post_checklogin: logincheck,
    get_signup: getsignup,
    post_createaccount: createAcc,
    get_home: getHome,
    get_createpost: getCreatePost,
    post_addpost: addPostAction,
    get_editaccount: getEditAccPage,
    post_saveaccountchanges: saveAccChanges,
    get_user_page: getUserPage,
    update_posts: updatePosts,
    logout: logout,
    update_friends: updateFriends,
    get_search: getSearchResults,
    update_search: updateSearchResults,
    get_visualizer: getVisualizer,
    update_visualizer: updateVisualizer,
    get_comments: getComments,
    add_comment: addComment,
    write_on_wall: writeOnWall,
    add_friend: addFriend,
    like_article: likeArticle
  };
  
  module.exports = routes;
