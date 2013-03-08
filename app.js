
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  //, user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;

var app = express();


require('./model/user')

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.cookieParser());
  app.use(express.session({ secret: "codesense" }));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

//app.get('/', routes.index);
//app.get('/users', user.list);

var server = http.createServer(app)
  ,  io = require('socket.io').listen(server);	

server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});


app.configure('development', function(){
  app.set('db-uri', 'mongodb://localhost/devdb');
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.set('db-uri', 'mongodb://localhost/prodb');
  app.use(express.errorHandler()); 
});

app.configure('test', function() {
  app.set('db-uri', 'mongodb://localhost/testdb');
});

db = mongoose.connect(app.set('db-uri'));

User = mongoose.model("User");

function requiresLogin(req, res, next) {
  console.log(req)
  if (req.session.user) {
    next();
  } else {
    res.redirect('sessions/new?redir=' + req.url);
  }
};

// Users

User = mongoose.model('User');

app.get('/users/new', function(req, res) {
  res.render('users/new.jade', {
    title: 'Sign Up',
    locals: { user: new User() }
  });
});

app.post('/users', function(req, res) {
  var user = new User(req.body.user);

  function userSaveFailed() {
    req.flash('error', 'Account creation failed');
    console.log('user save failed');
    res.render('users/new.jade', {
      locals: { user: user }
    });
  }

  user.save(function(err, u) {
    if (err) {
        console.log(err);
        return userSaveFailed();
    } else {
        console.log(u);
        req.session.user = u;
    }

    req.flash('info', 'Your account has been created');
    res.redirect('/');
  });
});

// Sessions

app.get('/sessions/new', function(req, res){
  res.render('sessions/new', {
    title: 'Login',
    redir: req.query.redir
  });
});

app.post('/sessions', function(req, res){
  User.findOne({ email: req.body.username }, function(err, user) {
    if (user && user.authenticate(req.body.password)) {
      req.session.user_id = user.id;
    } else {
      req.flash('error', 'Incorrect credentials');
      res.redirect('/sessions/new');
    }
  }); 
});

app.del('/sessions/new', requiresLogin, function(req, res){
  if (req.session.user) {
    req.session.user.destroy(function() {});
  }
  res.redirect('/sessions/new');
});

// Routes

app.get('/', requiresLogin, function(req, res){
  res.render('index', {
    title: 'Express'
  });
});


io.sockets.on( 'connection', function ( socket ) {

    socket.on('set nickname', function (nickname) {
        // Save a variable 'nickname'
        socket.set('nickname', nickname, function () {
            var connected_msg = nickname + ' is now connected.';
            console.log(connected_msg);
            io.sockets.volatile.emit('broadcast_msg', connected_msg)
        });
    });

    socket.on('emit_msg', function (msg) {
        // Get the variable 'nickname'
        socket.get('nickname', function (err, nickname) {
            console.log('Chat message by', nickname);
            io.sockets.volatile.emit( 'broadcast_msg' , nickname + ': ' + msg );
        });
    });
    socket.on('board_changed', function(new_text) {
        console.log('board chage deteted');
        io.sockets.volatile.emit('write_on_board', new_text);
    });
});
