# ScrumMasterBot
### Skype bot to help with management of scrum teams

This bot uses the Bot Builder SDK provided by microsoft and Node.js.

The documentation for this SDK can be found [here.](https://docs.botframework.com/en-us/node/builder/chat-reference/modules/_botbuilder_d_.html)

A useful overview of the key concepts behind use of the SDK and its features can be found [here.](https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-concepts)

Microsoft also provides examples of BotBuilder code [here.](https://github.com/Microsoft/BotBuilder-Samples/tree/master/Node) I have used these examples extensively in my code.

## A Brief Overview of the Code
#### .env File
The .env file contains the microsoft APP\_ID and APP\_PASSWORD. These are used to perform validation with the Microsoft Bot Framework. Once a new bot is registered, a new APP\_ID and APP\_PASSWORD must be generated and pasted into the .env file so the bot can access the skype channel.

#### Hosting the Bot
In testing ngrok has been used to connect the bot to the internet. This is a temporary solution for testing and a proper server should be set up in future. Another option is hosting the bot on azure, however this requires an azure subscription.

### main.js - Features of the BotBuilder SDK
#### Dialogs
Dialogs are the primary method of interacting with the user.

The BotBuilder website states:

>A dialog, at its most basic level, is a reusable module that performs an operation or collects information from a user.

Dialogs are used extensively in the code, and every command the user can input causes a dialog to run. Dialogs are maintained on a dialog stack and can be pushed onto the stack or popped off it. It works like a LIFO stack - the last dialog added will complete first.

The default dialog is called the **root dialog** and it is named "/". Whenever the dialog stack is empty, the root dialog will run. In the case of the ScrumMasterBot, this means that the default dialog will run once each command has been completed. 

##### Waterfalls and Prompts
A waterfall is a method of managing a conversation. It performs a sequence of steps; each step is defined by a function. Prompts can be used in a waterfall, prompting a user for an input then moving onto the next step. A waterfall must be ended with endDialog, endDialogWithResult or endConversation, otherwise it will start again, leaving the user trapped in a loop.

A simple waterfall is as follows:
```
// Ask the user for their name and greet them by name.
bot.dialog('greetings', [
    function (session) {
        builder.Prompts.text(session, 'Hi! What is your name?');
    },
    function (session, results) {
        session.endDialog('Hello %s!', results.response);
    }
]);
```

#### Cards and Carousels
Cards are a method of displaying information to the user. There are multiple types of cards, the ones used in this bot are exclusively heroCards. A heroCard can contain an image, a title, a subheading, text and buttons, however they can not display enough text to make them useful for displaying reports to the user. They are used for displaying a user's teammates, each person being represented by a card.

Carousels are a method of organising cards. Each carousel can hold up to 5 cards. This limit poses a problem, as a team of more than 5 cannot be displayed on a single carousel. Instead multiple carousels are used, each holding two cards. By only having two cards per carousel, we remove the need for the user to scroll along a list, thus improve usability and user experience.

### NOTES
**IMPORTANT** The node\_modules file in this repo contains a modified botbuilder module. The library.js file has been fixed. Using the standard module will lead to errors.
