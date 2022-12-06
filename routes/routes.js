const { addPost, getUserInfo } = require('../models/database.js');
var db = require('../models/database.js');

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

 var startChat = function(req, res) {
    var otherUser = req.body.usernameInput;

    // sort list of users then stringfy that list and look in db if any existing chats with this group

    var list_of_users = [req.session.username, otherUser];
    var sorted_list_of_users_string = list_of_users.sort().toString();

    var prevMessages = ["test", "hello"];
    // get prev messages from db

    

    res.render('chat.ejs', {message: null, user: req.session.username, otherUser: otherUser, prevMessages: prevMessages.toString()});
 };

 var getCreatePost = function(req, res) {
   if (req.session.postInfoBlank == true) {
    res.render('createpost.ejs', {message: 'Please complete all fields.'});
   } else if (req.session.postFailed == true) {
    res.render('createpost.ejs', {message: 'Post failed. Please try again.'});
   } else if (req.session.postSucceeded == true) {
    res.render('createpost.ejs', {message: 'Post succeeded! Post again or go back home.'});
   } else {
    res.render('createpost.ejs', {message: null});
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
  if (req.session.username == null) {
    res.render('signup.ejs', {message: null});
    return;
  }

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

    

   // if all good, add 
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
        db.getPostsForUser(req.session.username, function(err, data) {
            if (err) {
                res.redirect('home.ejs');
            } else {
                db.getPosts(data, function(err, data) {
                    if (err) {
                        console.log(err);
                        res.redirect('home.ejs');
                    } else {
                        db.getFriends(req.session.username, function(err, dataf) {
                          if (err) {
                            console.log(err);
                            res.redirect('home.ejs');
                          } else {
                            db.getUsersStatus(dataf, function(err, dataf2) {
                              if (err) {
                                console.log(err);
                                res.redirect('home.ejs');
                              } else {
                                for (post of data) {
                                  post.time_ago = time_ago(parseInt(post.timestamp.N));
                                }
                                console.log(dataf2);
                                res.render('user.ejs', {myposts: data, friends: dataf2, currUser: req.session.username});
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
                          res.render('home.ejs', {posts: data, friends: dataf2, currUser: req.session.username});
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
          res.send(JSON.stringify(data));
        }
      });
    }
  });
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

  if (seconds < 60) {
    return 'Just now'
  }
  if (seconds < 0) {
    seconds = Math.abs(seconds);
    token = 'from now';
    list_choice = 2;
  }
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

 var routes = { 
    get_main: getMain,
    post_start_chat: startChat,
    get_enter_chat: getEnterChat,
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
    update_friends: updateFriends
  };
  
  module.exports = routes;