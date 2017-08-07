//Import necessary modules and variables
require('dotenv-extended').load();
var db = require('./databaseTools');
var cards = require('./workingStatusCarousel');
var builder = require('botbuilder');
var restify = require('restify');
var schedule = require('node-schedule');
var datetime = require('node-datetime');

var commands = [/*"!addNew",*/ "!teamStatus", "!help", "!updateStatus", "!teamReset", "!assignTeams", "!forceStatusUpdate", "!submitReport", "!forceSubmitReport", "!viewReports"]

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot and listen to messages
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
server.post('/api/messages', connector.listen());

//set up bot
var bot = new builder.UniversalBot(connector);

// Create employee 'class' 
function employee(skypeID, address, name, team) {
	this.skypeID = skypeID;
	this.address = address;
	this.name = name;
	this.team = team;
	this.workingStatus = 'unknown';
}

// Create report 'class'
function report(skypeID, team, yesterdayText, todayText, issueText) {
	this.skypeID = skypeID;
	this.name = db.findValue(skypeID, "name");
	var dt = datetime.create();
	this.date = dt.format('d/m/Y');
	this.team = team;
	this.yesterdayText = yesterdayText;
	this.todayText = todayText;
	this.issueText = issueText;
}

//This is the dialog to take the user through adding a new employee to the DB
//SKYPEID AND ADDRESS ARE THE SAME THING - THIS ISNT REALLY CLEAR
// bot.dialog('/addNewUser', [
	// function (session) {
		// var newUserSkypeID;
		// var newUserName;
		// var newUserTeam;
		// builder.Prompts.text(session, 'Input the name of the new user');
	// },
	// function (session, results) {
		// newUserName = results.response;
		// var msg = session.message.address;
		// session.send(msg);//TESTING
		// builder.Prompts.text(session, 'Input the skypeID of the new user');
	// },
	// function (session, results) {
		// newUserSkypeID = results.response;
		// builder.Prompts.text(session, 'Input the team of the new user');
	// },
	// function (session, results) {
		// newUserTeam = results.response;
		// var newEmployee = new employee(newUserSkypeID, newUserName, newUserTeam);
		// db.saveEmployee(newEmployee);
		// session.endDialog("New user created");
	// }
// ]);

bot.dialog('/addFirstTimeUser', [
	function (session) {
		var newUserName;
		var newUserTeam;
		builder.Prompts.text(session, 'Input your name:');
	},
	function (session, results) {
		newUserName = results.response;
		builder.Prompts.text(session, 'Input your team:');
	},
	function (session, results) {
		newUserTeam = results.response;
		var newEmployee = new employee(session.message.address.user.id, session.message.address, newUserName, newUserTeam);
		db.saveEmployee(newEmployee);
		session.endDialog("New user created");
	}
]);
 
//This is a greeting function, only used so the user is not repeatedly greeted upon talking to the bot
bot.dialog('/introduce', function (session) {
	session.send("Hello user. This is the scrum master bot. For list of commands, input \"!help\"");
	session.endDialog();
});

bot.dialog('/teamStatus', [
	function (session) {
		builder.Prompts.text(session, "Input team to request");
		var searchTeam;
	},
	function (session, results) {
		searchTeam = results.response;
		var teamArray = db.findAll('team', searchTeam);
		var msg = cards.teamStatus(session, connector, teamArray);
		session.send(msg);
		session.endDialog();
	}
]);

//currently defunct - the other function replaces it
bot.dialog('/updateStatus', [
	function (session) {
		var skypeID;
		var newStatus;
		builder.Prompts.text(session, "Input SkypeID of user")
	},
	function (session, results) {
		skypeID = results.response;
		var msg = new builder.Message(session) //use beginDialogue() for this in working program OR replace it with a builder.Prompts.choice with the necessary options
			.text("Good Morning User")
			.suggestedActions(
				builder.SuggestedActions.create(
						session, [
							builder.CardAction.postBack(session, "In", "In"),
							builder.CardAction.postBack(session, "Out", "Home"),
							builder.CardAction.postBack(session, "Holiday", "Holiday")
						]
					));
		builder.Prompts.text(session, msg);
	},
	function (session, results) {
		newStatus = results.response;
		db.updateStatus(skypeID, newStatus);
		session.endDialog("Status updated");
	}
]);

//wipes the team values
bot.dialog('/teamReset', [
	function (session) {
		var response;
		builder.Prompts.text(session, "ARE YOU SURE? THE TEAMS CANNOT BE RECOVERED (Y/N)");
	},
	function (session, results) {
		response = results.response;
		response = response.toLowerCase();
		if (response == "y" || response == "yes") {
			db.wipeTeams();
			session.endDialog("Teams have been reset");
		}
		else {
			session.endDialog("No changes made");
		}
	}
]);

//requests update on the status of the user it sends this dialog to
bot.dialog('/updateUserStatus', [
	function (session) { 
		var msg = new builder.Message(session)
			.text("Good Morning User. Please input your working status today (In, Working from home or on Holiday)")
			.suggestedActions(
				builder.SuggestedActions.create(
						session, [
							builder.CardAction.postBack(session, "In", "In"),
							builder.CardAction.postBack(session, "Home", "Home"),
							builder.CardAction.postBack(session, "Holiday", "Holiday")
						]
					));
		builder.Prompts.text(session, msg);
	},
	function (session, results) {
		var skypeID = session.message.address.user.id;
		var newStatus = results.response;
		db.updateStatus(skypeID, newStatus);
		session.endDialog("Status updated");
	}
]);

bot.dialog('/assignTeams', [
	function (session) {
		var team;
		var newTeamMember;
		builder.Prompts.text(session, "Input the name of the team to add members to");
	},
	function (session, results) {
		team = results.response;
		var users = db.findAll('team' , 'null');
		var msg = cards.teamAssign(session, connector, users);
		builder.Prompts.text(session, msg);
	},
	function (session, results) {
		newTeamMember = results.response;
		db.updateTeam(newTeamMember, team);
		session.endDialog("New team member added");
	}
]); 

bot.dialog('/forceStatusUpdate', function (session) {
	db.wipeStatuses();
	var users = db.findAll("workingStatus", "unknown");
	for (i = 0; i < users.length; i++) {
		var address = users[i].address;
		bot.beginDialog(address, '/updateUserStatus');
	}
});

bot.dialog('/submitReport', [
	function (session) {
		var yesterdayInput;
		var todayInput;
		var issueInput;
		builder.Prompts.text(session, "Input what you did yesterday");
	},
	function (session, results) {
		yesterdayInput = results.response;
		builder.Prompts.text(session, "Input what you plan to do today");
	},
	function (session, results) {
		todayInput = results.response;
		builder.Prompts.text(session, "Input any issues you had (or \"no issues\")");
	},
	function (session, results) {
		issueInput = results.response;
		var skypeID = session.message.address.user.id;
		var team = db.findValue(skypeID, "team");
		var newReport = new report(skypeID, team, yesterdayInput, todayInput, issueInput);
		db.saveReport(newReport);
		session.endDialog("Report saved");
	}
]);

bot.dialog('/forceSubmitReport', function (session) {
	var team = db.findValue(session.message.address.user.id, "team");
	var users = db.findAll("team", team);
	for (i = 0; i < users.length; i++) {
		var address = users[i].address;
		bot.beginDialog(address, '/submitReport');
	}
});

bot.dialog('/viewReports', function (session) {
	var team = db.findValue(session.message.address.user.id, "team");
	var date = datetime.create();
	date = date.format('d/m/Y');
	var reports = db.findTeamReports(team, date);
	var msg = cards.reportCarousel(session, connector, reports);
	session.send(msg);
	session.endDialog();
});

//SCHEDULER
var statusUpdateRule = new schedule.RecurrenceRule();
//REMEMBER - THESE NEEED TO BE CHANGED AND THEY ALSO NEED TO BE CUSTOMISABLE
//THATS RIGHT - MORE JSON USAGE, MY FAVOURITE!!!
statusUpdateRule.minute = 30;
statusUpdateRule.hour = 9;

var statusUpdateJob = schedule.scheduleJob(statusUpdateRule, function(session) {
	db.wipeStatuses();
	var users = db.findAll("workingStatus", "unknown");
	for (i = 0; i < users.length; i++) {
		var address = users[i].address;
		bot.beginDialog(address, '/updateUserStatus');
	}
});

//This is the root dialog
bot.dialog('/', function (session) {
	var savedAddress;
	savedAddress = session.message.address;
	var notFirstTime = db.findUser(session.message.address.user.id);
	if (notFirstTime != true) {
		bot.beginDialog(savedAddress, '/addFirstTimeUser');
	} else if (!commands.includes(session.message.text)) {
		//POTENTIAL FOR BUGS HERE - TEST
		savedAddress = db.findValue(session.message.address.user.id, "address");
		bot.beginDialog(savedAddress, '/introduce');
	} 
	else switch(session.message.text) {
		//THIS IS NOT WORKING DUE TO ADDING AN ADDRESS FIELD TO THE DB - MAY REQUIRE EXTENSIVE WORK - MIGHT NEED TO BE DITCHED COMPLETELY
		//AS THE USER IS UNABLE TO INPUT ALL OF THE NECESSARY INFORMATION
		/*case "!addNew":
			bot.beginDialog(savedAddress, "/addNewUser");
			break;*/
		case "!teamStatus":
			bot.beginDialog(savedAddress, "/teamStatus");
			break;
		case "!help":
			session.send(commands.toString().replace(/,/g , " "));
			break;
		case "!updateStatus":
			bot.beginDialog(savedAddress, '/updateUserStatus');
			break;
		case "!teamReset":
			bot.beginDialog(savedAddress, "/teamReset");
			break;
		case "!assignTeams":
			bot.beginDialog(savedAddress, "/assignTeams");
			break;
		case "!forceStatusUpdate": 
			bot.beginDialog(savedAddress, "/forceStatusUpdate");
			break;
		case "!submitReport":
			bot.beginDialog(savedAddress, "/submitReport");
			break;
		case "!forceSubmitReport":
			bot.beginDialog(savedAddress, "/forceSubmitReport");
			break;
		case "!viewReports":
			bot.beginDialog(savedAddress, "/viewReports");
			break;
	}
});

