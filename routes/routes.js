var db = require('../models/database.js');

// routes here

var getMain = function(req, res) {
    res.render('loginpage.ejs', {message: null});
 };

 var getChat = function(req, res) {
    res.render('chat.ejs', {message: null});
 };



 var routes = { 
    get_main: getMain,
    get_chat: getChat,
  };
  
  module.exports = routes;
  

