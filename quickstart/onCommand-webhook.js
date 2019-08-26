//
// Copyright (c) 2016-2019 Cisco Systems
// Licensed under the MIT License 
//

/* 
 * a Webex Teams webhook that leverages a simple library (batteries included)
 * 
 * note : this example requires that you've set a ACCESS_TOKEN env variable 
 *  
 */

const SparkBot = require("node-sparkbot");

// Starts your Webhook with default configuration where the Webex Teams API access token is read from the SPARK_TOKEN env variable 
const bot = new SparkBot();

// Registers the bot to the Webex platform to start receiving notifications
// We list here various options to register your bot: pick one and update the code with your bot name and its public endpoint

// Simplissime registration where defaults apply (all, all, no filter, no secret), and no callback
//bot.createOrUpdateWebhook("register-bot", "https://f6d5d937.ngrok.io");

// Registration without any filter, secret, and callback
//bot.createOrUpdateWebhook("register-bot", "https://f6d5d937.ngrok.io", "all", "all");

// Registration with a filter, no secret, no callback
//bot.createOrUpdateWebhook("register-bot", "https://f6d5d937.ngrok.io", "all", "all", "roomId=XXXXXXXXXXXXXXX");

// Registration with no filter, but a secret and a callback
// note that the secret needs to be known to the bot so that it can check the payload signatures
const publicURL =  process.env.PUBLIC_URL || "https://f6d5d937.ngrok.io";
bot.secret = process.env.WEBHOOK_SECRET || "not THAT secret";
bot.createOrUpdateWebhook("register-bot", publicURL, "all", "all", null, bot.secret, function (err, webhook) {
  if (err) {
    console.error("could not create Webhook, err: " + err);

    // Fail fast
    process.exit(1);
  }

  console.log("webhook successfully checked, with id: " + webhook.id);
});

// Registration with no filter, but a secret and a callback
// bot name and public endpoint are read from env variables, the WEBHOOK_SECRET env variable is used to initialize the secret
// make sure to initialize these env variables
//  - BOT_NAME="register-bot"
//  - WEBHOOK_SECRET="not THAT secret"
//  - PUBLIC_URL="https://f6d5d937.ngrok.io"
// example:
//  DEBUG=sparkbot* BOT_NAME="register-bot" PUBLIC_URL="https://f6d5d937.ngrok.io" WEBHOOK_SECRET="not THAT secret" ACCESS_TOKEN="MjdkYjRhNGItM2E1ZS00YmZjLTk2ZmQtO" node tests/onCommand-register.js
//bot.createOrUpdateWebhook(process.env.BOT_NAME, process.env.PUBLIC_URL, "all", "all", null, bot.secret, function (err, webhook) {
//  if (err) {
//    console.log("Could not register the bot, please check your env variables are all set: ACCESS_TOKEN, BOT_NAME, PUBLIC_URL");
//    return;
//  }
//  console.log("webhook successfully created, id: " + webhook.id);
//});


// Override default prefix "/" to "" so that our bot will obey to "help"" instead of "/help"
bot.interpreter.prefix="";

bot.onCommand("help", function(command) {
  // ADD YOUR CUSTOM CODE HERE
  console.log("new command: " + command.keyword + ", from: " + command.message.personEmail + ", with args: " + JSON.stringify(command.args));
});



