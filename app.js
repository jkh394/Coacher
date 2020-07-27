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

const expressHbs =  require('express-handlebars');

//===set up app==================================================
//https://stackoverflow.com/questions/30767928/accessing-handlebars-variable-via-javascript
const hbs = expressHbs.create({
	helpers: {
		json: function(content) { return JSON.stringify(content); }
	}, 
	extname: "hbs",
	defaultLayout: "layout",
	layoutsDir: __dirname + "/views"
});
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');

const staticPath = path.resolve(__dirname, 'src');
app.use(express.static(staticPath));
app.use(parser.urlencoded({"extended":false}));

app.use(session({secret: 'secret for signing session id', saveUninitialized: false, resave: false}));

const User = mongoose.model('User');
const Coachee = mongoose.model('Coachee');
const Sessions = mongoose.model('Sessions');
const SubSession = mongoose.model('subSession');
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

app.use(passport.initialize());
app.use(passport.session());
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
		successRedirect: '/redirect',
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
	const name = first + " " + last;
	const _id = new mongoose.Types.ObjectId();
	User.create( {_id, username, password, first, last, name, phone} )
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

app.get('/redirect', function(req, res) {
	if (req.isAuthenticated()) {
		if(req.user.username === "admin@email"){
			res.redirect('/menu-admin');
		} else {
			res.redirect('/menu-coach');
		}
	} else {
		res.redirect('/');
	}
});

//~~~routes for coaches~~~
app.get('/menu-coach', function(req, res) {
	if (req.isAuthenticated()) {
		res.render('menu-coach', {name: req.user.first});
	} else {
		res.redirect('/');
	}
});

app.get('/view', function(req, res) {
	if (req.isAuthenticated()) {	
		res.render('view', {name: req.user.first});
	} else {
		res.redirect('/');
	}
});

app.get('/update', function(req, res) {
	if (req.isAuthenticated()) {
		res.render('update', {name: req.user.first});
	} else {
		res.redirect('/');
	}
});

//~~~routes for admin~~~
app.get('/menu-admin', function(req, res) {
	if (req.isAuthenticated()) {
		res.render('menu-admin', {name: req.user.first});
	} else {
		res.redirect('/');
	}
});

app.get('/coaches', function(req, res) {
	if (req.isAuthenticated()) {
		const queryObject = {};
		
		User.find(queryObject, function(err, result) {
			if (err) {
				console.log("Can't access User database");
			} else {
				const coachList = [];
				for (const i in result) {
					const coach = {
						first: result[i].first,
						last: result[i].last,
						email: result[i].username,
						phone: result[i].phone
					};
					coachList.push(coach);
				}
				res.render('coaches', {coachList: coachList, name: req.user.first});			
			}
		});
	} else {
		res.redirect('/');
	}
});

app.get('/coachees', function(req, res) {
	if (req.isAuthenticated()) {
		const queryObject = {};
		
		Coachee.find(queryObject, function(err, result) {
			if (err) {
				console.log("Can't access Coachee database");
			} else {
				const coacheeList = [];
				for (const i in result) {
					const coachee = {
						first: result[i].first,
						last: result[i].last,
						email: result[i].email,
						phone: result[i].phone
					};
					coacheeList.push(coachee);
				}
				res.render('coachees', {coacheeList: coacheeList, name: req.user.first});			
			}
		});
	} else {
		res.redirect('/');
	}
});

app.get('/add-coachee', function(req, res) {
	if (req.isAuthenticated()) {
		res.render('add-coachee', {name: req.user.first});
	} else {
		res.redirect('/');
	}
});

app.post('/add-coachee', function(req, res) {
	const coachee = {
		email: req.body.email,
		first: req.body.first,
		last: req.body.last,
		name: req.body.first + " " + req.body.last,
		phone: req.body.phone
	};
	
	Coachee.create(coachee, (err) => {
		if (err) {
			res.send(err);	
		} else {
			res.redirect('/coachees');
		}
	});
});

app.get('/sessions', function(req, res) {
	
	if (req.isAuthenticated()) {
		
		const queryObject = {};
		
		User.find(queryObject, function(err, coaches) {
			if (err) {
				console.log("Can't access User database");
			} else {
				Coachee.find(queryObject, function(err, coachees) {
					if (err) {
						console.log("Can't access Coachee database");
					} else {
						const coachList = [];
						const coacheeList = [];
						for (const i in coachees) {
							coacheeList.push(coachees[i].name);
						}
						for (const i in coaches) {
							coachList.push(coaches[i].name);	
						}
						
						let queryObject2 = {};
						if (req.query.coach) {
							queryObject2.coachName = req.query.coach;
						}
						if (req.query.coachee) {
							queryObject2.coachee = req.query.coachee;							
						}

						const sessionsList = [];
						Sessions.find( queryObject2, function(err, sessions) {
							for (const i in sessions) {
								const session = {
									coach: sessions[i].coachName,
									coachee: sessions[i].coachee,
									status: sessions[i].status,
									totalNum: sessions[i].totalNum
								}
								sessionsList.push(session);
							}
							res.render('sessions', {coachList: coachList, coacheeList: coacheeList, name: req.user.first, sessionsList: sessionsList});							
						});
					}
				});
			}
		});
		
	} else {
		res.redirect('/');
	}
});

app.get('/create-sessions', function(req, res) {
	if (req.isAuthenticated()) {
		const queryObject = {};
		
		User.find(queryObject, function(err, coaches) {
			if (err) {
				console.log("Can't access User database");
			} else {
				Coachee.find(queryObject, function(err, coachees) {
					if (err) {
						console.log("Can't access Coachee database");
					} else {
						const coachList = [];
						const coacheeList = [];
						for (const i in coachees) {
							coacheeList.push(coachees[i].name);
						}
						for (const i in coaches) {
							coachList.push(coaches[i].name);	
						}
						res.render('create-sessions', {coachList: coachList, coacheeList: coacheeList, name: req.user.first});
					}
				});
			}
		});
	} else {
		res.redirect('/');
	}
});

app.post('/create-sessions', function(req, res) {
	const queryObject = {name: req.body.coach};
	
	User.findOne(queryObject, function(err, coach) {
		if (err) {
			console.log("Can't access User database");
		} else {
			
			const sessionsID = new mongoose.Types.ObjectId();
			const sessions = {
				sessionsID: sessionsID,
				coachID: coach._id,
				coachName: coach.name,
				coachee: req.body.coachee,
				totalNum: req.body.totalNum,
				status: true,
				subSessions: []
			}
			
			let subSessionsList = [];
			for (let i = 0; i < req.body.totalNum; i++) {
				let subSession = {};
				if (i === 0) {
					subSession = {
						sessionsID: sessionsID,
						sessionNum: i + 1,
						sessionDate: req.body.sessionDate
					}
				} else {
					subSession = {
						sessionsID: sessionsID,
						sessionNum: i + 1
					}
				}
				SubSession.create(subSession, (err) => {
					if (err) {
						console.log("Error creating subSession");
					}
				});
				
				subSessionsList.push(subSession);
			}
			
			Sessions.create(sessions, (err) => {
				if (err) {
					console.log("Error creating sessions");
				} else {
					//add object to mongo array https://stackoverflow.com/questions/33049707/push-items-into-mongo-array-via-mongoose
					subSessionsList.forEach(subSession => sessions.subSessions.push(subSession));
				}
			});
			
			res.redirect('/sessions');
		}
	});
	
});

app.listen(process.env.PORT || 3000);