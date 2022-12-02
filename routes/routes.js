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
   
   if (!req.session.unameExist && !req.session.blankSign) {
    res.render('signup.ejs', {message: null});
   } else if (req.session.unameExist) {
    req.session.unameExist=false;
     res.render('signup.ejs', {message: 'Username already exists.'});
    } else if (req.session.blankSign) {
    req.session.blankSign=false;
     res.render('signup.ejs', {message: 'Please complete all fields.'});
    
    }
   
 };

 // get inputs
var createAcc= function(req, res) {
   var firstName = req.body.firstNameInput;
   var lastName = req.body.lastNameInput;
   var email = req.body.emailInput;
   var uname = req.body.usernameInput;
   var pass = req.body.passInput;
   var affiliation = req.body.affiliationInput;
   var birthday = req.body.birthdayInput;

var getHome = function(req, res) {
    res.render('home.ejs');
};

   if (!(firstName=="" || lastName=="" || email==""
   || uname=="" || pass=="" || affiliation=="" || birthday == "")) {
    // if all good, add 
    db.createUser(uname, email, firstName, lastName, pass, affiliation, birthday, function(err, data) {   
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
     get_home: getHome
  };
  
  module.exports = routes;
  

