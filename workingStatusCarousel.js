var db = require('./databaseTools');

var builder = require('botbuilder');
var restify = require('restify');

function userCard(session, connector, name, workingStatus, skypeID) {
	var card = new builder.HeroCard(session)
		.title(name)
		.subtitle(workingStatus.toString())
		.buttons([
            builder.CardAction.openUrl(session, 'https://azure.microsoft.com/en-us/services/storage/', 'See Report')
        ]);
	return card;
}

function userTeamAssignCard(session, connector, name, workingStatus, skypeID) {
	var card = new builder.HeroCard(session)
		.title(name)
		.subtitle(workingStatus.toString())
		.buttons([
            builder.CardAction.postBack(session, skypeID, 'Add ' + name + " to team")
        ]);
	return card;
}

function reportCard(session, connector, name, yesterdayText, todayText) {
	var card = new builder.HeroCard(session)
		.title(name)
		.subtitle(yesterdayText)
		.text(todayText)
	return card;
}	

module.exports = {
	userCard: function (session, connector, name, workingStatus, skypeID) {
		var card = new builder.HeroCard(session)
			.title(name)
			.subtitle(workingStatus)
			.text(skypeID)
			.buttons([
                builder.CardAction.openUrl(session, 'https://azure.microsoft.com/en-us/services/storage/', 'See Report')
            ]);
		return card;
	},
	teamStatus: function (session, connector, teamArray) {
		var msg = new builder.Message(session)
			.attachmentLayout(builder.AttachmentLayout.carousel);
		for (i = 0; i < teamArray.length; i++) {
			msg.addAttachment(userCard(session, connector, teamArray[i].name, teamArray[i].workingStatus, teamArray[i].skypeID));
		}
		return msg;
	},
	teamAssign: function (session, connector, teamArray) {
		var msg = new builder.Message(session)
			.attachmentLayout(builder.AttachmentLayout.carousel);
		for (i = 0; i < teamArray.length; i++) {
			msg.addAttachment(userTeamAssignCard(session, connector, teamArray[i].name, teamArray[i].workingStatus, teamArray[i].skypeID));
		}
		return msg;
	},
	reportCarousel: function (session, connector, reportArray) {
		var msg = new builder.Message(session)
			.attachmentLayout(builder.AttachmentLayout.carousel);
		for (i = 0; i < reportArray.length; i++) {
			msg.addAttachment(reportCard(session, connector, reportArray[i].name, reportArray[i].yesterdayText, reportArray[i].todayText));
		}
		return msg;
	}
};

