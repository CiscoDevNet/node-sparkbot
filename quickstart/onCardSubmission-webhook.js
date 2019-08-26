//
// Copyright (c) 2019 Cisco Systems
// Licensed under the MIT License 
//

/* 
 * a Webex Teams webhook that leverages a simple library (batteries included)
 * note:
 * - this example requires that you've set an ACCESS_TOKEN env variable with a Bot access token so that you can submit data from your Webex User account
 * - the code creates or updates a webhook that posts data to a publically accessible URL
 *  
 */


// Starts your Webhook with a default configuration where the Webex API access token is read from ACCESS_TOKEN
const SparkBot = require("node-sparkbot");
const bot = new SparkBot();

// Create webhook
const publicURL = process.env.PUBLIC_URL || "https://d3fc85fe.ngrok.io";
bot.secret = process.env.WEBHOOK_SECRET || "not THAT secret";
bot.createOrUpdateWebhook("register-bot", publicURL, "attachmentActions", "created", null, bot.secret, function (err, webhook) {
   if (err) {
      console.error("could not create Webhook, err: " + err);

      // Fail fast
      process.exit(1);
   }

   console.log("webhook successfully checked, with id: " + webhook.id);
});

bot.onCardSubmission(function (trigger, attachmentActions) {

   //
   // ADD YOUR CUSTOM CODE HERE
   //
   console.log(`new attachmentActions from personId: ${trigger.data.personId} , with inputs`);
   Object.keys(attachmentActions.inputs).forEach(prop => {
      console.log(`   ${prop}: ${attachmentActions.inputs[prop]}`);
   });

});



