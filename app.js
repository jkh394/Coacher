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

//https://github.com/caolan/async
const async = require('async');

//https://blog.greenroots.info/send-and-schedule-e-mails-from-a-nodejs-app-ck0l6usms000v4ns1lft6lauw
//https://stackoverflow.com/questions/48274326/running-cron-job-at-only-specific-date-and-time
const nodemailer = require('nodemailer');
const schedule = require('node-schedule');
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;

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
const Organization = mongoose.model('Organization');
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

const authObj = require('./authObj.js');
const oauth2Client = new OAuth2 (
	authObj.clientID, //ClientID
	authObj.clientSecret, //Client Secret
	"https://developers.google.com/oauthplayground" // Redirect URL
);
oauth2Client.setCredentials({
	refresh_token: authObj.refreshToken	
});
let accessToken;

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

app.get('/register-admin', (req, res) => {
	Organization.find({}, function(err, organizations) {
		let organizationsList = [];
		for (const i in organizations) {
			const organization = {name: organizations[i].name};
			organizationsList.push(organization);
			res.render('register-admin', {organizations: organizationsList});
		}
	});
});

app.post('/register-admin', (req, res) => {
	const { first, last, password, username, phone, organization } = req.body;
	const name = first + " " + last;
	const admin = true;
	User.create( {username, password, first, last, name, phone, admin, organization} )
		.then(user => {
			req.login(user, err => {
				if (err) {
					console.log(err);
				} else {
					res.redirect('/admin-success');
				}
			});
		})
		.catch(err => {
			if (err.name === "ValidationError") {
				Organization.find({}, function(err, organizations) {
					let organizationsList = [];
					for (const i in organizations) {
						const organization = {name: organizations[i].name};
						organizationsList.push(organization);
						res.render('register-admin', {message: "The given email address is already associated with an existing account. Please login or register with a different email address.", organizations: organizationsList});
					}
				});
			} else next(err);
		});
});

app.get('/admin-success', (req, res) => {
	res.render('admin-success');
});

app.get('/register', (req, res) => {
	Organization.find({}, function(err, organizations) {
		let organizationsList = [];
		for (const i in organizations) {
			const organization = {name: organizations[i].name};
			organizationsList.push(organization);
			res.render('register', {organizations: organizationsList});
		}
	});
});

//https://blog.cloudboost.io/node-js-authentication-with-passport-4a125f264cd4
app.post('/register', (req, res, next) => {
	const { first, last, password, username, phone, organization } = req.body;
	const name = first + " " + last;
	User.create( {username, password, first, last, name, phone, organization} )
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
				Organization.find({}, function(err, organizations) {
					let organizationsList = [];
					for (const i in organizations) {
						const organization = {name: organizations[i].name};
						organizationsList.push(organization);
						res.render('register', {message: "The given email address is already associated with an existing account. Please login or register with a different email address.", organizations: organizationsList});
					}
				});
			} else next(err);
		});
});

app.all('/logout', function(req, res) {
	req.logout();
	res.redirect('/');
});

app.get('/redirect', function(req, res) {
	if (req.isAuthenticated()) {
		
		const queryObject = {username: req.user.username};
		User.findOne(queryObject, function(err, user) {
			if (err) console.log('Unable to find user');
			if(user.admin === true){
				res.redirect('/menu-admin');
			} else {
				res.redirect('/menu-coach');
			}
		});
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
	
		const queryObject = {coach: req.user.name};

		Sessions.find(queryObject, function(err, sessions) {
			const sessionsList = [];
			for (const i in sessions) {
				const session = {
					sessionsID: sessions[i].sessionsID,
					coachee: sessions[i].coachee,
					status: sessions[i].status,
					totalNum: sessions[i].totalNum
				}
				sessionsList.push(session);
			}
			res.render('view', {name: req.user.first, sessionsList: sessionsList});
		});
	} else {
		res.redirect('/');
	}
});

app.get('/update', function(req, res) {
	if (req.isAuthenticated()) {
		
		const queryObject = {sessionsID: req.query.sessionsID, sessionNum: req.query.sessionNum};
		SubSession.findOne(queryObject, function(err, subSession) {
			const log = {};
			if(subSession.sessionDate) {
					log.sessionDate = subSession.sessionDate.toDateString()
			}
			res.render('update', {name: req.user.first, sessionsID: req.query.sessionsID, sessionNum: req.query.sessionNum, log: log});
		});

	} else {
		res.redirect('/');
	}
});

app.post('/update', function(req, res) {
	
	async.waterfall([
		function(callback) {
			const queryObject = {
				sessionsID: req.body.sessionsID, 
				sessionNum: req.body.sessionNum
			};
			const newData = {};
			if (req.body.canceled === "true") {
				newData.canceled = true;
			} else {
				newData.canceled = false;
			}
			if (req.body.advance) {
				newData.advance = (req.body.advance === 'true');
			}
			if (req.body.cancelDate) {
				const cancelDate = new Date(req.body.cancelDate + " ");
				newData.cancelDate = cancelDate;
			}
			if (req.body.notes) {
				newData.notes = req.body.notes;
			}
			if (req.body.last === "true") {
				newData.last = true;
			} else {
				newData.last = false;	
			}
			newData.logged = true;

			SubSession.findOneAndUpdate(queryObject, newData, {upsert: false}, function(err, updateLog) {
				if (err) return res.send(500, {error: err});
				
				if (req.body.nextDate || req.body.cancelDate) {
					let date;
					if (req.body.nextDate) {
						date = req.body.nextDate;
					} else {
						date = req.body.cancelDate;
					}
					
					const queryObject2 = {
						sessionsID: req.body.sessionsID,
						sessionNum: parseInt(req.body.sessionNum) + 1
					};

					const dateObj	= new Date(date + " ");
					const newData2 = { sessionDate: dateObj };
					SubSession.findOneAndUpdate(queryObject2, newData2, {upsert: true}, function(err, updateLog) {
						if (err) return res.send(500, {error: err});
						SubSession.findOne({sessionsID: updateLog.sessionsID, sessionNum: updateLog.sessionNum}, function(err, nextLog) {
							callback(null, nextLog);
						});
					});
				} else {
					callback(null, null);
				}
			});
		},
		function(nextLog, callback) {
			const queryObject = {sessionsID: req.body.sessionsID};
			SubSession.find(queryObject, function(err, logs) {
				const newData = {subSessions: logs};
				if(req.body.last === "true") {
					newData.status = false;
				} else {
					newData.status = true;
				}
				Sessions.findOneAndUpdate(queryObject, newData, {upsert: false}, function(err, updateSessions) {
					if (err) return res.send(500, {error: err});
					callback(null, nextLog, updateSessions);
				});	
			});
		}, 
		function(nextLog, updateSessions, callback) {
			User.findOne({admin:true}, function(err, admin) {
				if (err) console.log('Unable to find admin user');
					User.findOne({name: updateSessions.coach}, function(err, coach) {
						if (err) console.log('Unable to find coach user');
						Coachee.findOne({name: updateSessions.coachee}, function(err, coachee) {
							if (err) console.log('Unable to find coachee user');
							Organization.findOne({name: admin.organization}, function(err, organization) {
								if (err) console.log('Unable to find organization');
						
								if(nextLog) {
									//send email to remind coach to fill out session log
									const sessionLogMailOptions = {
										from: admin.username,
										to: coach.username,
										subject: 'Coaching Session Log Reminder',
										generateTextFromHTML: true,
										html: '<p>Hi ' + updateSessions.coach + ',&nbsp;</p>' + '<p>This is a small reminder to fill out the log for the coaching session that was held on ' + nextLog.sessionDate.toDateString() + ' with ' + updateSessions.coachee + '. You can access the coaching portal through the following link: <a href=\"' + organization.url + '/coacher\">' + organization.url + '/coacher</a>. If you have already filled out the log, please disregard this email. If you have any questions or concerns, please send an email to ' + organization.email + '. Thank you so much and we appreciate your dedication to our veterans!</p>' + '<p>Kind Regards,<br>' + admin.organization  + '&nbsp;</p>'
									};
									//send mail to remind coach & coachee of upcoming session
									const upcomingMailOptions = {
										from: admin.username,
										to: coach.username + "," + coachee.email,
										subject: 'Upcoming Coaching Session Reminder',
										generateTextFromHTML: true,
										html: '<p>Hello,</p>' + '<p>This is a small reminder that there is an upcoming session between ' + updateSessions.coach + ' and ' + updateSessions.coachee + ' on  ' + nextLog.sessionDate.toDateString() + '. Please direct any inquiries to ' + organization.email + '.</p>' + '<p>Best,<br>' + admin.organization  + '</p>'
									}
									
									if (!accessToken) {
										accessToken = oauth2Client.getAccessToken();
									}
									const smtpTransport = nodemailer.createTransport({
										service: "gmail", 
										auth: {
											type: authObj.type,
											user: "do.not.reply.coacher@gmail.com",
											clientId: authObj.clientID,
											clientSecret: authObj.clientSecret,
											refreshToken: authObj.refreshToken,
											accessToken: accessToken
										}
									});
									
									const beforeMS = nextLog.sessionDate.getTime() - 86400000;
									const afterMS = nextLog.sessionDate.getTime() + 86400000;
									const beforeDate = new Date(beforeMS);
									const afterDate = new Date(afterMS);
									console.log('Email assigned for next session:');
									console.log('* beforeDate: ', beforeDate);
									console.log('* afterDate: ', afterDate);
									schedule.scheduleJob(beforeDate, function() {
										smtpTransport.sendMail(upcomingMailOptions, function(error, info) {
											if (error) {
												console.log('Error sending email: ', error);
											} else {
												console.log('Email sent: ' + info.response);	
											}
										});
									});	
									schedule.scheduleJob(afterDate, function() {
										smtpTransport.sendMail(sessionLogMailOptions, function(error, info) {
											if (error) {
												console.log('Error sending email: ', error);
											} else {
												console.log('Email sent: ' + info.response);	
											}
										});
									});
								}
								
								const url = '/logs?sessionsID=' + req.body.sessionsID;
								res.redirect(url);	
							
							});
						});
					});
			});
		}
	], function(err, results) {});
});

app.get('/logs', function(req, res) {
	if (req.isAuthenticated()) {
		
		const queryObject = {sessionsID: req.query.sessionsID};
		
		Sessions.findOne(queryObject, function(err, sessions) {
			if (err) {
				console.log('Unable to access Sessions database');
			} else {
				User.findOne({name: sessions.coach}, function(err, coach) {
					if (err) console.log('Unable to access User database');
					Coachee.findOne({name: sessions.coachee}, function(err, coachee) {
						if (err) console.log('Unable to access Coachee database');
							const coachObj = {
								name: sessions.coach, 
								phone: coach.phone, 
								email: coach.username,
							}
							const coacheeObj = {
								name: sessions.coachee,
								phone: coachee.phone,
								email: coachee.email								
							}
							const sessionsLogs = [];
							for (const i in sessions.subSessions) {
								const log = {
									sessionsID: sessions.subSessions[i].sessionsID,
									sessionNum: sessions.subSessions[i].sessionNum,
									canceled: sessions.subSessions[i].canceled,
									advance: sessions.subSessions[i].advance, 
									logged: sessions.subSessions[i].logged, 
									last: sessions.subSessions[i].last,
									notes: sessions.subSessions[i].notes
								}
								if (sessions.subSessions[i].sessionDate) {
									log.sessionDate = sessions.subSessions[i].sessionDate.toDateString();
								}
								sessionsLogs.push(log);
							}
							res.render('logs', {name: req.user.first, sessionsID: req.query.sessionsID, coach: coachObj, coachee: coacheeObj, logs: sessionsLogs});
					});
				});
			}
		});
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
		const queryObject = {admin: false};
		
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
		phone: req.body.phone,
		organization: req.user.organization
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
		const queryObject = {admin: false};
		
		User.find(queryObject, function(err, coaches) {
			if (err) {
				console.log("Can't access User database");
			} else {
				Coachee.find({}, function(err, coachees) {
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
							queryObject2.coach = req.query.coach;
						}
						if (req.query.coachee) {
							queryObject2.coachee = req.query.coachee;							
						}

						const sessionsList = [];
						Sessions.find( queryObject2, function(err, sessions) {
							for (const i in sessions) {
								const session = {
									sessionsID: sessions[i].sessionsID,
									coach: sessions[i].coach,
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

app.post('/sessions', function(req, res) {
	if (req.isAuthenticated()) {
		const queryObject = {sessionsID: req.body.sessionsID};
		
		Sessions.findOne(queryObject, function(err, sessions) {
			if (err) {
				console.log('Unable to access Sessions database');
			} else {
				const queryObject2 = {sessionsID: req.body.sessionsID};
				const newData = {};
				if (req.body.coach) {
					newData.coach = req.body.coach;
				}
				if (req.body.coachee) {
					newData.coachee = req.body.coachee;
				}
				if (req.body.totalNum) {
					newData.totalNum = req.body.totalNum;
				}
				if (req.body.status !== sessions.status.toString()) {
					newData.status = (req.body.status === 'true');
				}
				Sessions.findOneAndUpdate(queryObject2, newData, {upsert: false}, function(err, updateSessions) {
					if (err) return res.send(500, {error: err});
					res.redirect('/sessions');
				});	
			}
		});
	} else {
		res.redirect('/');
	}
});	
	
app.get('/create-sessions', function(req, res) {
	if (req.isAuthenticated()) {
		const queryObject = {admin: false};
		
		User.find(queryObject, function(err, coaches) {
			if (err) {
				console.log("Can't access User database");
			} else {
				Coachee.find({}, function(err, coachees) {
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
				coach: coach.name,
				coachee: req.body.coachee,
				totalNum: req.body.totalNum,
				status: true,
				subSessions: []
			}
			
			let subSessionsList = [];
			for (let i = 0; i < req.body.totalNum; i++) {
				let subSession = {};
				if (i === 0) {
					const sessionDate = new Date(req.body.sessionDate + " ");
					subSession = {
						sessionsID: sessionsID,
						sessionNum: i + 1,
						sessionDate: sessionDate,
					}
				} else {
					subSession = {
						sessionsID: sessionsID,
						sessionNum: i + 1, 
					}
				}
				SubSession.create(subSession, (err) => {
					if (err) {
						console.log("Error creating subSession");
					}
				});
				
				subSessionsList.push(subSession);
			}
			
			//https://stackoverflow.com/questions/40269584/async-callback-is-not-a-function
			async.waterfall([
				function (callback) {
					Sessions.create(sessions, function(err, newSession) {
						callback(null, newSession);
					})
				}, 
				function (newSession, callback) {
					const newData = { subSessions: subSessionsList };
					Sessions.findOneAndUpdate({sessionsID: newSession.sessionsID}, newData, {upsert: false}, function(err, updateSessions) {
						if (err) return res.send(500, {error: err});
						User.findOne({admin: true}, function(err, admin) {
							User.findOne({name: updateSessions.coach}, function(err, coach) {
								Coachee.findOne({name: updateSessions.coachee}, function(err, coachee) {
									if (err) console.log('Unable to find coachee');
									Organization.findOne({name: admin.organization}, function(err, organization) {
										if (err) console.log('Unable to find organization');
								
											//send email to remind coach to fill out session log
											const sessionLogMailOptions = {
												from: admin.username,
												to: coach.username,
												subject: 'Coaching Session Log Reminder',
												generateTextFromHTML: true,
												html: '<p>Hi ' + updateSessions.coach + ',&nbsp;</p>' + '<p>This is a small reminder to fill out the log for the coaching session that was held on ' + subSessionsList[0].sessionDate.toDateString() + ' with ' + updateSessions.coachee + '. You can access the coaching portal through the following link: <a href=\"' + organization.url + '/coacher\">' + organization.url + '/coacher</a>. If you have already filled out the log, please disregard this email. If you have any questions or concerns, please send an email to ' + organization.email + '. Thank you so much and we appreciate your dedication to our veterans!</p>' + '<p>Kind Regards,<br>' + admin.organization  + '&nbsp;</p>'
											};
											//send mail to remind coach & coachee of upcoming session
											const upcomingMailOptions = {
												from: admin.username,
												to: coach.username + "," + coachee.email,
												subject: 'Upcoming Coaching Session Reminder',
												generateTextFromHTML: true,
												html: '<p>Hello,</p>' + '<p>This is a small reminder that there is an upcoming session between ' + updateSessions.coach + ' and ' + updateSessions.coachee + ' on  ' + subSessionsList[0].sessionDate.toDateString() + '. Please direct any inquiries to ' + organization.email + '.</p>' + '<p>Best,<br>' + admin.organization  + '</p>'
											}
											
											if (!accessToken) {
												accessToken = oauth2Client.getAccessToken();
											}
											const smtpTransport = nodemailer.createTransport({
												service: "gmail", 
												auth: {
													type: authObj.type,
													user: "do.not.reply.coacher@gmail.com",
													clientId: authObj.clientID,
													clientSecret: authObj.clientSecret,
													refreshToken: authObj.refreshToken,
													accessToken: accessToken
												}
											});
											
											const beforeMS = subSessionsList[0].sessionDate.getTime() - 86400000;
											const afterMS = subSessionsList[0].sessionDate.getTime() + 86400000;
											const beforeDate = new Date(beforeMS);
											const afterDate = new Date(afterMS);
											console.log('Email assigned for next session:');
											console.log('* beforeDate: ', beforeDate);
											console.log('* afterDate: ', afterDate);
											schedule.scheduleJob(beforeDate, function() {
												smtpTransport.sendMail(upcomingMailOptions, function(error, info) {
													if (error) {
														console.log('Error sending email: ', error);
													} else {
														console.log('Email sent: ' + info.response);	
													}
												});
											});	
											schedule.scheduleJob(afterDate, function() {
												smtpTransport.sendMail(sessionLogMailOptions, function(error, info) {
													if (error) {
														console.log('Error sending email: ', error);
													} else {
														console.log('Email sent: ' + info.response);	
													}
												});
											});
									
									});
									
								});
							});
						});	
					});	
				}
			], function(err, results) {});
			
			res.redirect('/sessions');
		}
	});
	
});

app.get('/edit-sessions', function(req, res) {
	if (req.isAuthenticated()) {
		const queryObject = {admin: false};
		
		User.find(queryObject, function(err, coaches) {
				if (err) {
					console.log("Can't access User database");
				} else {
					Coachee.find({}, function(err, coachees) {
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
							
							const queryObject2 = {sessionsID: req.query.sessionsID};
							Sessions.findOne(queryObject2, function (err, sessions) {
								if (err) {
									console.log("Unable to find sessions");
								} else {
									const sessionsObject = {
										sessionsID: sessions.sessionsID,
										coach: sessions.coach,
										coachee: sessions.coachee,
										totalNum: sessions.totalNum,
										status: sessions.status
									};
									res.render('edit-sessions', {coachList: coachList, coacheeList: coacheeList, name: req.user.first, sessions: sessionsObject});
								}
							});
						}
					});
				}
			});
	} else {
		res.redirect('/sessions');
	}
});

app.get('/sessions-log', function(req, res) {
	if (req.isAuthenticated()) {
		const queryObject = {sessionsID: req.query.sessionsID};
		
		Sessions.findOne(queryObject, function(err, sessions) {
			if (err) {
				console.log('Unable to access Sessions database');
			} else {
				User.findOne({name: sessions.coach}, function(err, coach) {
					if (err) console.log('Unable to access User database');
					Coachee.findOne({name: sessions.coachee}, function(err, coachee) {
						if (err) console.log('Unable to access Coachee database');
							const coachObj = {
								name: sessions.coach, 
								phone: coach.phone, 
								email: coach.username,
							}
							const coacheeObj = {
								name: sessions.coachee,
								phone: coachee.phone,
								email: coachee.email								
							}
							const sessionsLogs = [];
							for (const i in sessions.subSessions) {
								const log = {
									sessionsID: sessions.subSessions[i].sessionsID,
									sessionNum: sessions.subSessions[i].sessionNum,
									canceled: sessions.subSessions[i].canceled,
									advance: sessions.subSessions[i].advance, 
									logged: sessions.subSessions[i].logged, 
									last: sessions.subSessions[i].last,
									notes: sessions.subSessions[i].notes
								}
								if (sessions.subSessions[i].sessionDate) {
									log.sessionDate = sessions.subSessions[i].sessionDate.toDateString();
								}
								sessionsLogs.push(log);
							}
							res.render('sessions-log', {name: req.user.first, sessionsID: req.query.sessionsID, coach: coachObj, coachee: coacheeObj, logs: sessionsLogs});
					});
				});
			}
		});
	} else {
		res.redirect('/');
	}
});

app.get('/delete-sessions', function(req, res) {
	if (req.isAuthenticated()) {

		const queryObject = {sessionsID: req.query.sessionsID};
		
		Sessions.findOneAndDelete(queryObject, function(err, deleteSessions) {
			SubSession.deleteMany(queryObject, function(err, deleteLogs) {
				res.redirect('/sessions');
			});
		});
		
	} else {
		res.redirect('/');
	}
});

app.listen(process.env.PORT || 3000);