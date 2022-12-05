/* Some initialization boilerplate. Also, we include the code from
   routes/routes.js, so we can have access to the routes. Note that
   we get back the object that is defined at the end of routes.js,
   and that we use the fields of that object (e.g., routes.get_main)
   to access the routes. */

   var express = require('express');
   var routes = require('./routes/routes.js');
   var app = express();
   app.use(express.urlencoded());
   
   
   var session = require('express-session');
   app.use(session({secret:'random'}))
   app.use(express.json());

   const http = require('http');
   const server = http.createServer(app);
   const { Server } = require("socket.io");
   const io = new Server(server);
   
   
   /* Below we install the routes. The first argument is the URL that we
      are routing, and the second argument is the handler function that
      should be invoked when someone opens that URL. Note the difference
      between app.get and app.post; normal web requests are GETs, but
      POST is often used when submitting web forms ('method="post"'). */
   
   app.get('/', routes.get_main);
   app.get('/chat', routes.get_chat);
   app.get('/signup', routes.get_signup);
   app.post('/checklogin', routes.post_checklogin);
   app.post('/createaccount', routes.post_createaccount);
   app.get('/home', routes.get_home);
    app.get('/user', routes.get_user_page);

   app.get('/createpostpage', routes.get_createpost);
   app.post('/addpost', routes.post_addpost);

   app.get('/editaccount', routes.get_editaccount);
   app.post('/saveaccountchanges', routes.post_saveaccountchanges);

   app.get('/updateposts', routes.update_posts);

   app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
  })


   io.on('connection', (socket) => {
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
        console.log('message: ' + msg);
      });
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
      });
      
  });

   
   /* Run the server */

   server.listen(8080, () => {
    console.log('listening on *:8080');
   });

   console.log('Server running on port 8080. Now open http://localhost:8080/ in your browser!');
