//
// Copyright (c) 2016-2019 Cisco Systems
// Licensed under the MIT License 
//

/* 
 * a bot that listens to all Webex Teams Webhook events
 * 
 */

var SparkBot = require("node-sparkbot");

// Starts your Webhook with default configuration 
var bot = new SparkBot();
 
bot.onEvent("all", "all", function(trigger) {
  
    //
    // YOUR CODE HERE
    //
    console.log("New event (" + trigger.resource + "/" + trigger.event + "), with data id: " + trigger.data.id + ", triggered by person id:" + trigger.actorId);
    console.log("Learn more about Webhooks: at https://developer.webex.com/webhooks-explained.html");
});

