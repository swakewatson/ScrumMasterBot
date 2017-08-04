var db = require('./databaseTools');

var builder = require('botbuilder');
var restify = require('restify');

function userCard(session, connector, name, workingStatus, skypeID) {
	var card = new builder.HeroCard(session)
		.title(name)
		.subtitle(workingStatus.toString())
		.text(skypeID)
		.buttons([
            builder.CardAction.openUrl(session, 'https://azure.microsoft.com/en-us/services/storage/', 'See Report')
        ]);
	return card;
}

/* function userTeamAssignCard(session, connector, name, workingStatus, skypeID) {
	var card = new builder.HeroCard(session)
		.title(name)
		.subtitle(workingStatus.toString())
		.text(skypeID)
		.buttons([
            builder.CardAction.dialogAction(session, 'https://azure.microsoft.com/en-us/services/storage/', 'See Report')
        ]);
	return card;
} */

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
	/* teamAssign: function (session, connector, teamArray) {
		var msg = new builder.Message(session)
			.attachmentLayout(builder.AttachmentLayout.carousel);
		for (i = 0; i < teamArray.length; i++) {
			msg.addAttachment(userCard(session, connector, teamArray[i].name, teamArray[i].workingStatus, teamArray[i].skypeID));
		}
		return msg;
	} */
};

