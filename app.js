//===require modules=======================================
const express = require('express');
const app = express();
const session = require('express-session');

const path = require('path');

const parser = require('body-parser');

require( './db' );
const mongoose = require('mongoose');

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

//https://github.com/jaredhanson/connect-flash
const flash = require('connect-flash');

const bcrypt = require('bcrypt');
const saltRounds = 15;

//===set up app==================================================
app.set('view engine', 'hbs');
const staticPath = path.resolve(__dirname, 'src');

app.use(express.static(staticPath));
app.use(parser.urlencoded({"extended":false}));

app.use(session({secret: 'secret for signing session id', saveUninitialized: false, resave: false}));

const User = mongoose.model('User');
const Coachee = mongoose.model('Coachee');
const Session = mongoose.model('Session');
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

app.use(passport.initialize());
app.use(passport.session());
//passport.use(new passportLocal(User.authenticate()));
//passport.serializeUser(User.serializeUser());
//passport.deserializeUser(User.deserializeUser());
passport.serializeUser(function(user, done) { //store user id in passport
	done(null, user._id);
});
passport.deserializeUser(function(userId, done) { //fetch user from database using id
	User.findById(userId, (err, user) => done(err, user));
});

//local authentication strategy:
//		* check if user is in database
//		* check if hash of submitted password matches stored hash
//		* call done or false 
const local = new LocalStrategy((username, password, done) => {
	User.findOne( {username} )
		.then(user => {
			if (!user || !user.validPassword(password)) {
				done(null, false, { message: "Invalid username or password. Please try again or register a new account." });
			} else {
				done(null, user);	
			}
		})
		.catch(e => done(e));
});
passport.use('local', local);

app.use(flash()); //<-- set up flash middleware for passport

//middleware for routes in app
const loggedInOnly = (req, res, next) => {
	if (req.isAuthenticated()) next();
	else res.redirect('/');	
};
const loggedOutOnly = (req, res, next) => {
	if (req.isUnauthenticated()) next();
	else res.redirect('/coacher');
};

//===app routes====================================================
app.get('/', (req, res) => {
	res.render('login', {message: req.flash('error')});
});

app.post('/', passport.authenticate("local", {
		successRedirect: '/coacher',
		failureRedirect: '/',
		failureFlash: true
	})
);

app.get('/register', (req, res) => {
	res.render('register');
});

//https://blog.cloudboost.io/node-js-authentication-with-passport-4a125f264cd4
app.post('/register', (req, res, next) => {
	const { first, last, password, username, phone } = req.body;
	const _id = new mongoose.Types.ObjectId();
	User.create( {_id, username, password, first, last, phone} )
		.then(user => {
			req.login(user, err => {
				if (err) {
					next(err);
				} else {
					req.flash("Account has been successfully registered. Please login.");
					res.redirect('/');
				}
			});
		})
		.catch(err => {
			if (err.name === "ValidationError") {
				req.flash("The given email address is already associated with an existing account. Please login or register with a different email address.");
				res.redirect('/register');
			} else next(err);
		});
});

app.all('/logout', function(req, res) {
	req.logout();
	res.redirect('/');
});

app.get('/coacher', function(req, res) {
	res.render('coacher');
});

app.listen(process.env.PORT || 3000);