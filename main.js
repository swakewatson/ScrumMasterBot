//Import necessary modules and variables
require('dotenv-extended').load();
var db = require('./databaseTools');
var cards = require('./workingStatusCarousel');
var builder = require('botbuilder');
var restify = require('restify');
var schedule = require('node-schedule');

var commands = ["!addNew", "!teamStatus", "!help", "!updateStatus", "!teamReset"]

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
function employee(skypeID, name, team) {
	this.skypeID = skypeID;
	this.name = name;
	this.team = team;
	this.workingStatus = 'unknown';
}

//This is the dialog to take the user through adding a new employee to the DB
//SKYPEID AND ADDRESS ARE THE SAME THING - THIS ISNT REALLY CLEAR
bot.dialog('/addNewUser', [
	function (session) {
		var newUserSkypeID;
		var newUserName;
		var newUserTeam;
		builder.Prompts.text(session, 'Input the name of the new user');
	},
	function (session, results) {
		newUserName = results.response;
		var msg = session.message.address;
		session.send(msg);//TESTING
		builder.Prompts.text(session, 'Input the skypeID of the new user');
	},
	function (session, results) {
		newUserSkypeID = results.response;
		builder.Prompts.text(session, 'Input the team of the new user');
	},
	function (session, results) {
		newUserTeam = results.response;
		var newEmployee = new employee(newUserSkypeID, newUserName, newUserTeam);
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
		//var name = db.findValue('vuihsdfiogherio', 'name');
		//var workingStatus = db.findValue('vuihsdfiogherio', 'workingStatus');
		var teamArray = db.findAll('team', searchTeam);
		var msg = cards.teamStatus(session, connector, teamArray);
		session.send(msg);
		session.endDialog();
	}
]);

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

//This one takes the skypeID already loaded in the scheduler job - i think
bot.dialog('/updateUserStatus', [
	function (session) {
		//skypeID;
		var msg = new builder.Message(session)
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

//SCHEDULER!!! YAY
var statusUpdateRule = new schedule.RecurrenceRule();
//REMEMBER - THESE NEEED TO BE CHANGED AND THEY ALSO NEED TO BE CUSTOMISABLE
//THATS RIGHT - MORE JSON USAGE, MY FAVOURITE!!!
statusUpdateRule.minute = 27;
statusUpdateRule.hour =9;

var statusUpdateJob = schedule.scheduleJob(statusUpdateRule, function(session) {
	db.wipeStatuses();
	var users = db.findAll("team", "null");
	for (i = 0; i < users.length; i++) {
		var skypeID = users[i].skypeID;
		session.send(skypeID); //TESTING
		bot.beginDialog(skypeID, '/updateUserStatus');
	}
});

//This is the root dialog
bot.dialog('/', function (session) {
	var savedAddress;
	savedAddress = session.message.address;
	if (!commands.includes(session.message.text)) {
		bot.beginDialog(savedAddress, '/introduce');
	} 
	else switch(session.message.text) {
		case "!addNew":
			bot.beginDialog(savedAddress, "/addNewUser");
			break;
		case "!teamStatus":
			bot.beginDialog(savedAddress, "/teamStatus");
			break;
		case "!help":
			session.send(commands.toString().replace(/,/g , " "));
			break;
		case "!updateStatus":
			bot.beginDialog(savedAddress, '/updateStatus');
			break;
		case "!teamReset":
			bot.beginDialog(savedAddress, "/teamReset");
			break;
	}
});

