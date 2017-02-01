//
// Copyright (c) 2016 Cisco Systems
// Licensed under the MIT License 
//

var SparkBot = require("../sparkbot/webhook");

// Starts your Webhook with default configuration where the SPARK API access token is read from the SPARK_TOKEN env variable 
var bot = new SparkBot();

var registration = require("../sparkbot/registration.js");
registration.createWebhook(bot.token, "Test sparkbot", "https://requestb.in/123456", "all", "all", null, bot.secret, 
    function(err, webhook) {
        console.log("done, webhook created");
        registration.listWebhooks(bot.token, function (err, webhooks) {
            console.log("webhooks list: " + JSON.stringify(webhooks));
            registration.deleteWebhook(bot.token, webhook.id, function (err, code) {
                console.log("done, webhook deleted");
                registration.listWebhooks(bot.token, function (err, webhooks) {
                     console.log("webhooks list: " + JSON.stringify(webhooks));
                });
            });
        });
    });

bot.onCommand("help", function(command) {

  //
  // ADD YOUR CUSTOM CODE HERE
  //  
  console.log("new command: " + command.keyword + ", from: " + command.message.personEmail + ", with args: " + JSON.stringify(command.args));
  
});


