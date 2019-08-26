//
// Copyright (c) 2016-2019 Cisco Systems
// Licensed under the MIT License 
//

/* 
 * a Webex Teams webhook that leverages a simple library (batteries included)
 *
 */

// Starts your Webhook with default configuration 
const SparkBot = require("node-sparkbot");
const bot = new SparkBot();

// Specify the secret to check against incoming payloads
bot.secret = "not THAT secret"
 
bot.onEvent("all", "all", function(trigger) {
  
    //
    // YOUR CODE HERE
    //
    console.log("EVENT: " + trigger.resource + "/" + trigger.event + ", with data id: " + trigger.data.id + ", triggered by person id:" + trigger.actorId);
  
});

