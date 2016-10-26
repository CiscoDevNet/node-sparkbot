//
// Copyright (c) 2016 Cisco Systems
// Licensed under the MIT License 
//

/* 
 * a bot that :
 *   - sends a welcome message as he joins a room, 
 *   - answers to a hello command
 *   - implements help
 *   - adds help as a fallback command
 * 
 */

var SparkBot = require("node-sparkbot");
var bot = new SparkBot();

// Remove comment to overlad command default "/" prefix
//bot.interpreter.prefix = "#";
 
bot.onCommand("fallback", function (command) {
    // so happy to join
    spark.messageSendRoom(command.message.roomId, {
        text: "sorry, I did not understand"
    })
        .then(function (message) {
            // show how to use
            showHelp(command.message.roomId);
        });
});
bot.onCommand("help", function (command) {
    showHelp(command.message.roomId);
});
function showHelp(roomId) {
    spark.messageSendRoom(roomId, {
        markdown: "I can give you quick access to Spark technical data:\n- /about\n- /help\n- /room: reveals this room identifier\n- /whoami: shows your spark info\n- /whois @mention: learn about other participants\n"
    });
}


bot.onCommand("room", function (command) {
    spark.messageSendRoom(command.message.roomId, {
        markdown: "roomId: " + command.message.roomId
    });

});


bot.onCommand("rooms", function (command) {
    spark.messageSendRoom(command.message.roomId, {
        markdown: "roomId: " + command.message.roomId
    });

});


bot.onCommand("whoami", function (command) {
    spark.messageSendRoom(command.message.roomId, {
        markdown: "personId: " + command.message.personId + "\n\nemail: " + command.message.personEmail
    });
});


bot.onCommand("whois", function (command) {
    // Check usage
    if (command.message.mentionedPeople.length != 2) {
        spark.messageSendRoom(command.message.roomId, {
            markdown: "sorry, I cannot proceed if you do not mention a room participant"
        });
        return;
    }

    var participant = command.message.mentionedPeople[1];

    spark.personGet(participant).then(function (person) {
        spark.messageSendRoom(command.message.roomId, {
            markdown: "personId: " + person.id + "\n\ndisplayName: " + person.displayName + "\n\nemail: " + person.emails[0]
        });
    });
});


bot.onEvent("memberships", "created", function (trigger) {
    var newMembership = trigger.data; // see specs here: https://developer.ciscospark.com/endpoint-memberships-get.html
    if (newMembership.personId == bot.interpreter.person.id) {
        debug("bot's just added to room: " + trigger.data.roomId);

        // so happy to join
        spark.messageSendRoom(trigger.data.roomId, {
            text: "Hi, I am the Inspector Bot !"
        })
            .then(function (message) {
                if (message.roomType == "group") {
                    spark.messageSendRoom(message.roomId, {
                        markdown: "**Note that this is a 'Group' room. I will wake up only when mentionned.**"
                    })
                        .then(function (message) {
                            showHelp(message.roomId);
                        });
                }
                else {
                    showHelp(message.roomId);
                }
            });
    }
});

