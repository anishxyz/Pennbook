const { addPost } = require('../models/database.js');
var db = require('../models/database.js');

// routes here
 var getMain = function(req, res) {
   if (req.session.loginBlank != true && req.session.loginIncorrect != true) {
       res.render('loginpage.ejs', {message: null});
  } else if (req.session.loginBlank == true) {
       req.session.loginBlank=false;
    res.render('loginpage.ejs', {message: 'Please complete all fields.'});
  } else if (req.session.loginIncorrect == true) {
    req.session.loginIncorrect=false;
    res.render('loginpage.ejs', {message: 'Username or password is incorrect.'});
  }
};

 var getChat = function(req, res) {
    res.render('chat.ejs', {message: null});
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
         res.redirect('/home');
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
    res.session.lessInterests = false;
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
  // if (!req.session.unameExist && !req.session.blankSign) {
  //  res.render('signup.ejs', {message: null});
  // } else if (req.session.unameExist) {
  //  req.session.unameExist=false;
  //   res.render('signup.ejs', {message: 'Username already exists.'});
  //  } else if (req.session.blankSign) {
  //  req.session.blankSign=false;
  //   res.render('signup.ejs', {message: 'Please complete all fields.'});
   
  //  }

  if (req.session.username == null) {
    res.render('signup.ejs', {message: null});
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

    res.render('editaccount.ejs', 
    {message: message, 
    user:req.session.username,
    firstName: data.firstName.S,
    lastName: data.lastName.S,
    email: data.email.S,
    affiliation: data.affiliation.S,
    birthday: data.birthday.S,
    });

  });
};


// get inputs
var saveAccChanges= function(req, res) {

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
  // TODO: IMPLEMENT INTERESTS
  var TEST_INTERESTS = ["TESTING ONLY MUST CHANGE"]

  if (!(firstName=="" || lastName=="" || email==""
  || username=="" || affiliation=="" || birthday == "")) {

    

   // if all good, add 
   db.updateUserInfo(username, "firstName", firstName, function(err, data) {   
      if ((err == null)) {
        db.updateUserInfo(username, "lastName", lastName, function(err, data) {   
          if ((err == null)) {
            db.updateUserInfo(username, "email", email, function(err, data) {   
              if ((err == null)) {
                db.updateUserInfo(username, "affiliation", affiliation, function(err, data) {   
                  if ((err == null)) {

                    // create new post with affiliation update if different from before
                    if(prevAffiliation!=affiliation) {
                      const affiliationChangeText = req.session.username + " changed their affiliation to \"" + affiliation + "\"";
                      db.addPost(req.session.username, "status_update", affiliationChangeText, Date.now(), function(err, data) {   
                        if ((err != null)) {
                          console.log("COULD NOT POST STATUS UPDATE")
                        } else {
                        }
                      });
                    }


                    db.updateUserInfo(username, "birthday", birthday, function(err, data) {   
                      if ((err == null)) {
                        if (password == "") {
                          // only update pass if new pass entered
                          res.redirect('/home');
                        } else {
                          console.log("Updating password to: ", password, "with username: ", username);
                          db.updateUserInfo(username, "password", password, function(err, data) {   
                            if ((err == null)) {
                              res.redirect('/home');
                            } else {
                                console.log("ERROR", err)
                                req.session.accChangeDidNotWork = true;
                                res.redirect('/editaccount');
                            }
                          });
                        }
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



 var getHome = function(req, res) {
     if(req.session.username == null) {
         res.render('signup.ejs', {message: null});
         return;
     }
     db.getPostsForUser(req.session.username, function(err, data) {
         if (err) {
             res.render('signup.ejs', {message: null});
         } else {
          db.getPosts(data, function(err, data) {
            if (err) {
              console.log(err);
              res.render('signup.ejs', {message: null});
            } else {
                console.log(data);
                db.getFriends(req.session.username, function(err, dataf) {
                    if (err) {
                        console.log(err);
                        res.render('signup.ejs', {message: null});
                    } else {
                        res.render('home.ejs', {posts: data, friends: dataf, currUser: req.session.username});
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

 var routes = { 
    get_main: getMain,
    get_chat: getChat,
    post_checklogin: logincheck,
    get_signup: getsignup,
    post_createaccount: createAcc,
    get_home: getHome,
    get_createpost: getCreatePost,
    post_addpost: addPostAction,
    get_editaccount: getEditAccPage,
    post_saveaccountchanges: saveAccChanges,
  };
  
  module.exports = routes;